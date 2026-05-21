import { neon } from "@neondatabase/serverless";
import { generateEmbedding } from "@/lib/db";
import { laptops, mobiles } from "@/lib/seedData";

export async function POST() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) return Response.json({ success: false, error: "DATABASE_URL_UNPOOLED not set" }, { status: 500 });
  const sql = neon(url);

  try {
    await sql`TRUNCATE TABLE products RESTART IDENTITY`;

    const allProducts = [
      ...laptops.map((p) => ({ ...p, category: "laptop" as const })),
      ...mobiles.map((p) => ({ ...p, category: "mobile" as const })),
    ];

    let seeded = 0;

    for (const product of allProducts) {
      const textForEmbedding = [
        product.name,
        product.brand,
        product.category,
        product.description,
        Object.entries(product.specs).map(([k, v]) => `${k}: ${v}`).join(", "),
      ].join(". ");

      const embedding = await generateEmbedding(textForEmbedding);
      const embeddingStr = `[${embedding.join(",")}]`;
      const specsJson = JSON.stringify(product.specs);

      await sql`
        INSERT INTO products (name, category, brand, price, description, specs, embedding)
        VALUES (
          ${product.name},
          ${product.category},
          ${product.brand},
          ${product.price},
          ${product.description},
          ${specsJson}::jsonb,
          ${embeddingStr}::vector
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
