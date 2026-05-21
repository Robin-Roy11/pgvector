import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pooled — for regular queries (fast)
function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// Unpooled — required for DDL (CREATE EXTENSION, CREATE TABLE, CREATE INDEX)
function getDbUnpooled() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");
  return neon(url);
}

export async function setupDatabase() {
  const sql = getDbUnpooled();

  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('laptop', 'mobile')),
      brand TEXT NOT NULL,
      price NUMERIC NOT NULL,
      description TEXT NOT NULL,
      specs JSONB,
      embedding vector(1536)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS products_embedding_idx
    ON products USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
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

export async function searchProducts(
  query: string,
  category: "laptop" | "mobile" | "all",
  maxPrice: number
): Promise<Product[]> {
  const sql = getDb();
  const embedding = await generateEmbedding(query);
  const embeddingStr = `[${embedding.join(",")}]`;

  let rows;
  if (category === "all") {
    rows = await sql`
      SELECT id, name, category, brand, price, description, specs,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM products
      WHERE price <= ${maxPrice}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT 20
    `;
  } else {
    rows = await sql`
      SELECT id, name, category, brand, price, description, specs,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM products
      WHERE category = ${category}
        AND price <= ${maxPrice}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT 20
    `;
  }

  return rows as Product[];
}
