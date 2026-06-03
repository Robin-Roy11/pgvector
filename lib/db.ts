import { neon } from "@neondatabase/serverless";
import type { SpecRequirements } from "@/lib/parseSpecs";
import { matchesSpecRequirements } from "@/lib/parseSpecs";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function getDbUnpooled() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");
  return neon(url);
}

export async function setupDatabase() {
  const sql = getDbUnpooled();

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // Create table with full schema (no-op if already exists)
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL CHECK (category IN ('laptop', 'mobile')),
      brand       TEXT NOT NULL,
      price       NUMERIC NOT NULL,
      description TEXT NOT NULL,
      specs       JSONB,
      embedding   vector(768),
      search_text TEXT
    )
  `;

  // Migrate: embedding column at wrong dimension (e.g. 1536 from old OpenAI era)
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        WHERE c.relname = 'products'
          AND a.attname = 'embedding'
          AND a.atttypmod IS DISTINCT FROM 768
          AND a.atttypmod > 0
      ) THEN
        DROP INDEX IF EXISTS products_embedding_idx;
        ALTER TABLE products DROP COLUMN embedding;
        ALTER TABLE products ADD COLUMN embedding vector(768);
      END IF;
    END
    $$
  `;

  // Add search_text column to existing tables that pre-date this schema
  await sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS search_text TEXT
  `;

  // Vector similarity index
  await sql`DROP INDEX IF EXISTS products_embedding_idx`;
  await sql`
    CREATE INDEX IF NOT EXISTS products_embedding_idx
    ON products USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  // GIN index for full-text search across all fields
  await sql`DROP INDEX IF EXISTS products_fts_idx`;
  await sql`
    CREATE INDEX IF NOT EXISTS products_fts_idx
    ON products USING GIN (to_tsvector('english', COALESCE(search_text, '')))
  `;
}

async function generateEmbeddingOllama(text: string): Promise<number[]> {
  const base = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
  const res = await fetch(`${base}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data.embedding) || data.embedding.length !== 768) {
    throw new Error(`Unexpected Ollama embedding shape: ${data.embedding?.length}`);
  }
  return data.embedding as number[];
}

async function generateEmbeddingHuggingFace(text: string): Promise<number[]> {
  const token = process.env.HF_API_TOKEN;
  if (!token) throw new Error("HF_API_TOKEN is not set");
  const res = await fetch(
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-mpnet-base-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`HuggingFace error ${res.status}: ${await res.text()}`);
  const raw = await res.json();
  const vec: number[] = Array.isArray(raw[0]) ? raw[0] : raw;
  if (!Array.isArray(vec) || vec.length !== 768) {
    throw new Error(`Unexpected HuggingFace embedding shape: ${vec?.length}`);
  }
  return vec;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return await generateEmbeddingOllama(text);
  } catch (ollamaErr) {
    console.warn("Ollama embedding failed, trying HuggingFace:", ollamaErr);
    return generateEmbeddingHuggingFace(text);
  }
}

export interface Product {
  id: number;
  name: string;
  category: "laptop" | "mobile";
  brand: string;
  price: number;
  description: string;
  specs: Record<string, string>;
  similarity?: number;
}

export type SearchMode = "semantic" | "fulltext";

// Strip price/budget patterns from the query before FTS — they're handled by the
// SQL price filter, and unmatched number tokens cause FTS to return zero rows.
function prepareQueryForFTS(query: string): string {
  const stripped = query
    .replace(
      /\b(?:under|below|less\s+than|max(?:imum)?|upto|up\s+to|within|budget(?:\s+of)?)\s*[₹rs.]*\s*[\d,]+\s*(?:k|lakh|lac|l|cr(?:ore)?)?\b/gi,
      ""
    )
    .replace(/[₹]\s*[\d,]+\s*(?:k|lakh|lac|l)?\b/gi, "")
    .replace(/\b[\d,]+\s*(?:rupees?|rs\.?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || query;
}

export async function searchProducts(
  query: string,
  category: "laptop" | "mobile" | "all",
  maxPrice: number,
  specReqs: SpecRequirements = {}
): Promise<{ results: Product[]; mode: SearchMode }> {
  const sql = getDb();

  // Attempt semantic vector search (Ollama → HuggingFace)
  try {
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(",")}]`;

    // Fetch extra rows so in-memory spec filtering still has enough to return
    const rows =
      category === "all"
        ? await sql`
            SELECT id, name, category, brand, price, description, specs,
                   1 - (embedding <=> ${embeddingStr}::vector) AS similarity
            FROM products
            WHERE price <= ${maxPrice}
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${embeddingStr}::vector
            LIMIT 60
          `
        : await sql`
            SELECT id, name, category, brand, price, description, specs,
                   1 - (embedding <=> ${embeddingStr}::vector) AS similarity
            FROM products
            WHERE category = ${category}
              AND price <= ${maxPrice}
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${embeddingStr}::vector
            LIMIT 60
          `;

    const filtered = (rows as Product[])
      .filter((r) => matchesSpecRequirements(r, specReqs))
      .slice(0, 20);

    return { results: filtered, mode: "semantic" };
  } catch {
    return searchProductsFTS(query, category, maxPrice, specReqs);
  }
}

export async function searchProductsFTS(
  query: string,
  category: "laptop" | "mobile" | "all",
  maxPrice: number,
  specReqs: SpecRequirements = {}
): Promise<{ results: Product[]; mode: SearchMode }> {
  const sql = getDb();
  const ftsQuery = prepareQueryForFTS(query);

  // websearch_to_tsquery is more forgiving than plainto_tsquery —
  // it handles quoted phrases, OR, and ignores unknown words gracefully.
  const rows =
    category === "all"
      ? await sql`
          SELECT id, name, category, brand, price, description, specs,
                 ts_rank(
                   to_tsvector('english', COALESCE(search_text, '')),
                   websearch_to_tsquery('english', ${ftsQuery})
                 ) AS similarity
          FROM products
          WHERE price <= ${maxPrice}
            AND to_tsvector('english', COALESCE(search_text, ''))
                @@ websearch_to_tsquery('english', ${ftsQuery})
          ORDER BY similarity DESC
          LIMIT 60
        `
      : await sql`
          SELECT id, name, category, brand, price, description, specs,
                 ts_rank(
                   to_tsvector('english', COALESCE(search_text, '')),
                   websearch_to_tsquery('english', ${ftsQuery})
                 ) AS similarity
          FROM products
          WHERE category = ${category}
            AND price <= ${maxPrice}
            AND to_tsvector('english', COALESCE(search_text, ''))
                @@ websearch_to_tsquery('english', ${ftsQuery})
          ORDER BY similarity DESC
          LIMIT 60
        `;

  const filtered = (rows as Product[])
    .filter((r) => matchesSpecRequirements(r, specReqs))
    .slice(0, 20);

  return { results: filtered, mode: "fulltext" };
}
