import { neon } from "@neondatabase/serverless";
import { generateEmbedding } from "@/lib/db";
import { laptops, mobiles } from "@/lib/seedData";

// Builds a single string containing every searchable token for a product.
// Stored in the search_text column and used for FTS + GIN indexing.
function buildSearchText(product: {
  name: string;
  brand: string;
  category: string;
  price: number;
  description: string;
  specs: Record<string, string | undefined>;
}): string {
  const specTokens = Object.entries(product.specs)
    .filter(([, val]) => val !== undefined)
    .map(([key, val]) => `${key} ${val}`)
    .join(" ");

  return [
    product.name,
    product.brand,
    product.category,
    // Price stored in multiple formats so queries like "45999", "46k", "below 50000" all surface it
    `price ${product.price}`,
    `₹${product.price}`,
    product.description,
    specTokens,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Richer natural-language text for the embedding — helps semantic search
// understand concepts like "budget laptop" or "gaming phone".
function buildEmbeddingText(product: {
  name: string;
  brand: string;
  category: string;
  price: number;
  description: string;
  specs: Record<string, string | undefined>;
}): string {
  const specLines = Object.entries(product.specs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return [
    `${product.name} by ${product.brand}`,
    `Type: ${product.category}`,
    `Price: ₹${product.price}`,
    product.description,
    specLines,
  ].join(". ");
}

export async function POST() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url)
    return Response.json(
      { success: false, error: "DATABASE_URL_UNPOOLED not set" },
      { status: 500 }
    );

  const sql = neon(url);

  try {
    await sql`TRUNCATE TABLE products RESTART IDENTITY`;

    const allProducts = [
      ...laptops.map((p) => ({ ...p, category: "laptop" as const })),
      ...mobiles.map((p) => ({ ...p, category: "mobile" as const })),
    ];

    let seeded = 0;

    for (const product of allProducts) {
      const embeddingText = buildEmbeddingText(product);
      const searchText = buildSearchText(product);

      const embedding = await generateEmbedding(embeddingText);
      const embeddingStr = `[${embedding.join(",")}]`;
      const specsJson = JSON.stringify(product.specs);

      await sql`
        INSERT INTO products (name, category, brand, price, description, specs, embedding, search_text)
        VALUES (
          ${product.name},
          ${product.category},
          ${product.brand},
          ${product.price},
          ${product.description},
          ${specsJson}::jsonb,
          ${embeddingStr}::vector,
          ${searchText}
        )
      `;

      seeded++;
      console.log(`Seeded ${seeded}/${allProducts.length}: ${product.name}`);
    }

    return Response.json({
      success: true,
      message: `Seeded ${seeded} products (${laptops.length} laptops + ${mobiles.length} mobiles)`,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return Response.json({ success: false, error: String(error) }, { status: 500 });
  }
}
