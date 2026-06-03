"use client";

import { useState } from "react";
import Link from "next/link";

interface AdminContentProps {
  orgSlug: string;
  userEmail: string;
}

export default function AdminContent({ orgSlug, userEmail }: AdminContentProps) {
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
              {orgSlug} &middot; {userEmail}
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/settings" className="text-sm text-gray-500 hover:underline">
              Settings
            </Link>
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to Search
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Step 1 */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Step 1 — Setup Database</h2>
          <p className="text-sm text-gray-600 mb-4">
            Creates the <code className="bg-gray-100 px-1 rounded">organizations</code> and{" "}
            <code className="bg-gray-100 px-1 rounded">products</code> tables with pgvector extension
            and IVFFlat indices.
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
            Inserts <strong>12 laptops</strong> and <strong>14 mobiles</strong> for org{" "}
            <strong>{orgSlug}</strong> with Ollama + CLAP embeddings.
          </p>
          <p className="text-xs text-amber-600 mb-4">
            ⚠️ Takes ~1–2 minutes. Existing products for this org will be replaced.
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
          <p className="text-gray-500 mb-2 font-sans text-xs">Multi-tenant schema</p>
          <pre>{`CREATE TABLE organizations (
  id          UUID PRIMARY KEY,
  slug        TEXT UNIQUE,
  name        TEXT,
  plan        TEXT DEFAULT 'free'
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  org_id      TEXT,            -- org scope
  name        TEXT,
  category    TEXT,
  brand       TEXT,
  price       NUMERIC,
  specs       JSONB,
  embedding   vector(768),     -- Ollama text
  clap_embedding vector(512)   -- CLAP audio
);`}</pre>
        </div>
      </div>
    </main>
  );
}
