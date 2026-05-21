"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminPage() {
  const [setupStatus, setSetupStatus] = useState("");
  const [seedStatus, setSeedStatus] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const handleSetup = async () => {
    setSetupLoading(true);
    setSetupStatus("");
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      setSetupStatus(
        data.success
          ? `✅ ${data.message}`
          : `❌ Error: ${data.error}`
      );
    } catch (e) {
      setSetupStatus(`❌ Request failed: ${e}`);
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    setSeedStatus("⏳ Seeding… this takes ~1-2 min (generating embeddings for all products)");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      setSeedStatus(
        data.success
          ? `✅ ${data.message}`
          : `❌ Error: ${data.error}`
      );
    } catch (e) {
      setSeedStatus(`❌ Request failed: ${e}`);
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚙️ Admin Setup</h1>
            <p className="text-sm text-gray-500 mt-1">
              Initialize database and seed product data
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Search
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Step 1 */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Step 1 — Setup Database</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enables the <code className="bg-gray-100 px-1 rounded">pgvector</code> extension and creates the{" "}
            <code className="bg-gray-100 px-1 rounded">products</code> table with a{" "}
            <code className="bg-gray-100 px-1 rounded">vector(1536)</code> column + IVFFlat index.
          </p>
          <button
            onClick={handleSetup}
            disabled={setupLoading}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {setupLoading ? "Setting up…" : "Run Setup"}
          </button>
          {setupStatus && (
            <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              {setupStatus}
            </p>
          )}
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Step 2 — Seed Products</h2>
          <p className="text-sm text-gray-600 mb-1">
            Inserts <strong>12 laptops</strong> and <strong>14 mobiles</strong> with OpenAI embeddings.
          </p>
          <p className="text-xs text-amber-600 mb-4">
            ⚠️ This calls OpenAI&apos;s embeddings API 26 times. Ensure <code>OPENAI_API_KEY</code> is set. Takes ~1–2 minutes.
          </p>
          <button
            onClick={handleSeed}
            disabled={seedLoading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {seedLoading ? "Seeding…" : "Seed Data"}
          </button>
          {seedStatus && (
            <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
              {seedStatus}
            </p>
          )}
        </div>

        {/* Schema reference */}
        <div className="bg-gray-900 rounded-xl p-5 text-sm text-gray-300 font-mono">
          <p className="text-gray-500 mb-2 font-sans text-xs">Schema reference</p>
          <pre>{`CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT CHECK (category IN ('laptop','mobile')),
  brand       TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  description TEXT NOT NULL,
  specs       JSONB,
  embedding   vector(1536)   -- OpenAI ada-002
);

CREATE INDEX ON products
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);`}</pre>
        </div>
      </div>
    </main>
  );
}
