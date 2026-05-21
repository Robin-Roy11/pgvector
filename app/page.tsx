"use client";

import { useState } from "react";

interface Product {
  id: number;
  name: string;
  category: "laptop" | "mobile";
  brand: string;
  price: number;
  description: string;
  specs: Record<string, string>;
  similarity: number;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "laptop" | "mobile">("all");
  const [maxPrice, setMaxPrice] = useState("100000");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const params = new URLSearchParams({
        q: query,
        category,
        maxPrice: maxPrice || "999999",
      });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results);
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const fillExample = (q: string, cat: "laptop" | "mobile", price: string) => {
    setQuery(q);
    setCategory(cat);
    setMaxPrice(price);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">
            🔍 PGVector Product Search
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Semantic search with OpenAI embeddings + pgvector cosine similarity
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Form */}
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-xl shadow-sm border p-6 mb-4"
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What are you looking for?
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "thin laptop for coding" or "camera phone"'
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as "all" | "laptop" | "mobile")
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="laptop">💻 Laptops</option>
                  <option value="mobile">📱 Mobiles</option>
                </select>
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Price (₹)
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="e.g. 50000"
                  min="0"
                  step="1000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-gray-500 self-center">Try:</span>
          {[
            { label: "Gaming laptop ≤₹1.5L", q: "gaming laptop", cat: "laptop" as const, price: "150000" },
            { label: "Best camera phone", q: "best camera phone", cat: "mobile" as const, price: "150000" },
            { label: "Thin light laptop", q: "thin and light laptop", cat: "laptop" as const, price: "120000" },
            { label: "Budget phone ≤₹30k", q: "budget smartphone", cat: "mobile" as const, price: "30000" },
          ].map((ex) => (
            <button
              key={ex.label}
              onClick={() => fillExample(ex.q, ex.cat, ex.price)}
              className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {searched && !loading && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              {results.length === 0
                ? "No results found."
                : `${results.length} result${results.length !== 1 ? "s" : ""} found`}
            </p>
            <div className="grid gap-4">
              {results.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-lg">
                          {product.category === "laptop" ? "💻" : "📱"}
                        </span>
                        <h3 className="font-semibold text-gray-900">
                          {product.name}
                        </h3>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {product.brand}
                        </span>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full capitalize">
                          {product.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {product.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(product.specs)
                          .slice(0, 4)
                          .map(([key, val]) => (
                            <span
                              key={key}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md"
                            >
                              <span className="font-medium capitalize">{key}:</span>{" "}
                              {val}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-gray-900">
                        {formatPrice(product.price)}
                      </div>
                      <div className="text-xs text-green-600 mt-1 font-medium">
                        {(product.similarity * 100).toFixed(1)}% match
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        {!searched && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800">
            <p className="font-semibold mb-2">How PGVector search works</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Query is converted to a 1536-dimension vector via <code className="bg-blue-100 px-1 rounded">text-embedding-ada-002</code></li>
              <li>pgvector finds nearest neighbors using <code className="bg-blue-100 px-1 rounded">{"<=> cosine distance"}</code></li>
              <li>Results are filtered by category and max price</li>
              <li>Products are ranked by semantic similarity score (0–100%)</li>
            </ol>
            <p className="mt-3 text-blue-600 text-xs">
              📌 First time? Go to <strong>/admin</strong> to set up the DB and seed data.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
