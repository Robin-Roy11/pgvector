# PGVector Product Search

A Next.js app demonstrating semantic search with **pgvector** and **OpenAI embeddings**.

## What it does

- Stores laptop and mobile product data in **Vercel Postgres** with `pgvector`
- Each product gets a **1536-dimension embedding** via OpenAI `text-embedding-ada-002`
- Search queries are embedded and matched using **cosine similarity** (`<=>` operator)
- Filter by category (laptops / mobiles / all) and max price

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | Vercel Postgres + pgvector |
| Embeddings | OpenAI text-embedding-ada-002 |
| Styling | Tailwind CSS v4 |

## Setup

### 1. Create a Vercel Postgres database

Go to Vercel Dashboard → Storage → Create Database → Postgres.
Copy the env vars and paste into `.env.local`.

### 2. Add your OpenAI API key to `.env.local`

```
OPENAI_API_KEY=sk-...
```

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Initialize the database

Visit `http://localhost:3000/admin`:
1. **Run Setup** — creates `products` table with `vector(1536)` column + IVFFlat index
2. **Seed Data** — inserts 26 products with embeddings (~1–2 min)

### 5. Search

Visit `http://localhost:3000`. Try:
- "thin laptop for developers"
- "camera phone with good battery"
- "gaming laptop with RTX"
- "budget smartphone under 30000"

## Deploy to Vercel

```bash
vercel deploy
```

Add env vars in Vercel project settings (same as `.env.local`).

## How the pgvector query works

```sql
SELECT *, 1 - (embedding <=> '[...1536 floats...]'::vector) AS similarity
FROM products
WHERE category = 'laptop'
  AND price <= 100000
  AND embedding IS NOT NULL
ORDER BY embedding <=> '[...1536 floats...]'::vector
LIMIT 20;
```

`<=>` = cosine distance. `1 - distance = similarity` (higher = better match).
The IVFFlat index makes nearest-neighbor lookup fast at scale.
