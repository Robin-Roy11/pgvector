const { neon } = require("@neondatabase/serverless");
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...val] = line.split('=');
        process.env[key.trim()] = val.join('=').trim();
      }
    }
  }
}

loadEnv();

async function inspectDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    return;
  }
  const sql = neon(url);
  try {
    const dims = await sql`
      SELECT 
        attname as column_name,
        atttypmod as dimension
      FROM pg_attribute 
      WHERE attrelid = 'products'::regclass 
        AND attname IN ('embedding', 'clap_embedding')
    `;
    console.log("Vector Dimensions in DB:", dims);
  } catch (err) {
    console.error("Database query failed:", err);
  }
}

inspectDb();
