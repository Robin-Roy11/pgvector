"use client";

import { useState, useRef, useCallback } from "react";

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

type SearchMode = "semantic" | "fulltext";
type Tab = "text" | "audio";

function Badge({
  label,
  color,
}: {
  label: string;
  color: "blue" | "yellow" | "green" | "gray";
}) {
  const cls: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    green: "bg-green-50 text-green-700 border-green-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`text-xs border px-2 py-0.5 rounded-full font-medium ${cls[color]}`}
    >
      {label}
    </span>
  );
}

function ProductCard({
  product,
  formatPrice,
}: {
  product: Product;
  formatPrice: (p: number) => string;
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg">
              {product.category === "laptop" ? "💻" : "📱"}
            </span>
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {product.brand}
            </span>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full capitalize">
              {product.category}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">{product.description}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(product.specs)
              .slice(0, 4)
              .map(([key, val]) => (
                <span
                  key={key}
                  className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md"
                >
                  <span className="font-medium capitalize">{key}:</span> {val}
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
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("text");

  // — Text search state —
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null);
  const [textCategory, setTextCategory] = useState<string>("");
  const [textMaxPrice, setTextMaxPrice] = useState<number | undefined>();

  // — Audio search state —
  const [recording, setRecording] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [audioResults, setAudioResults] = useState<Product[]>([]);
  const [audioSearched, setAudioSearched] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [audioMode, setAudioMode] = useState<SearchMode | null>(null);
  const [transcriptionSource, setTranscriptionSource] = useState<
    "huggingface" | null
  >(null);
  const [detectedCategory, setDetectedCategory] = useState<string>("");
  const [detectedPrice, setDetectedPrice] = useState<number | undefined>();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const fillExample = (q: string) => setQuery(q);

  const handleTextSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    setSearchMode(null);
    setTextCategory("");
    setTextMaxPrice(undefined);
    try {
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results);
        setSearchMode(data.mode ?? null);
        setTextCategory(data.category ?? "");
        setTextMaxPrice(data.maxPrice);
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await submitAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setAudioError("");
    } catch (err) {
      setAudioError(
        `Microphone access denied: ${err instanceof Error ? err.message : err}`,
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const submitAudio = async (blob: Blob) => {
    setAudioLoading(true);
    setAudioSearched(true);
    setAudioResults([]);
    setTranscription("");
    setAudioMode(null);
    setTranscriptionSource(null);
    setDetectedCategory("");
    setDetectedPrice(undefined);

    try {
      const fd = new FormData();
      fd.append("audio", blob, "query.webm");
      const res = await fetch("/api/search-audio", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (data.error) {
        setAudioError(data.error);
      } else {
        setAudioResults(data.results ?? []);
        setTranscription(data.transcribedText ?? "");
        setAudioMode(data.mode ?? null);
        setTranscriptionSource(data.transcriptionSource ?? null);
        setDetectedCategory(data.category ?? "");
        setDetectedPrice(data.maxPrice);
      }
    } catch (err) {
      setAudioError(
        `Request failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">
            🔍 PGVector Product Search
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Semantic search with Ollama embeddings + pgvector · Audio search via
            HuggingFace Whisper
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {(["text", "audio"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "text" ? "✏️ Text Search" : "🎤 Audio Search"}
            </button>
          ))}
        </div>

        {/* ── TEXT SEARCH ── */}
        {tab === "text" && (
          <>
            <form
              onSubmit={handleTextSearch}
              className="bg-white rounded-xl shadow-sm border p-6 mb-4"
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='e.g. "thin laptop for coding" or "camera phone"'
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>
            </form>

            {/* Quick examples */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-xs text-gray-500 self-center">Try:</span>
              {[
                {
                  label: "Gaming laptop ≤₹1.25L",
                  q: "gaming laptop under 125000",
                },
                { label: "Best camera phone", q: "best camera phone" },
                {
                  label: "Snapdragon 8 Gen 3 phone",
                  q: "Snapdragon 8 Gen 3 smartphone",
                },
                { label: "Samsung 16GB phone", q: "Samsung phone 16GB RAM" },
                {
                  label: "Thin laptop ≤₹80k",
                  q: "thin light laptop under 80000",
                },
                { label: "AMOLED phone ≤₹50k", q: "AMOLED phone under 50000" },
              ].map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => fillExample(ex.q)}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
                {error}
              </div>
            )}

            {loading && (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border p-5 animate-pulse"
                  >
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {searched && !loading && (
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <p className="text-sm text-gray-500">
                    {results.length === 0
                      ? "No results found."
                      : `${results.length} result${results.length !== 1 ? "s" : ""} found`}
                  </p>
                  {searchMode === "semantic" && (
                    <Badge label="Semantic search" color="blue" />
                  )}
                  {searchMode === "fulltext" && (
                    <Badge label="Full-text search" color="yellow" />
                  )}
                  {textCategory && textCategory !== "all" && (
                    <Badge label={`Category: ${textCategory}`} color="gray" />
                  )}
                  {textMaxPrice !== undefined && (
                    <Badge
                      label={`Max: ₹${textMaxPrice.toLocaleString("en-IN")}`}
                      color="gray"
                    />
                  )}
                </div>
                <div className="grid gap-4">
                  {results.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              </div>
            )}

            {!searched && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800">
                <p className="font-semibold mb-2">How it works</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>
                    Query → 768-dim vector via{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      nomic-embed-text
                    </code>{" "}
                    (Ollama) or{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      all-mpnet-base-v2
                    </code>{" "}
                    (HuggingFace fallback)
                  </li>
                  <li>
                    pgvector finds nearest neighbors using cosine distance
                  </li>
                  <li>
                    Last resort: PostgreSQL full-text search if both are
                    unavailable
                  </li>
                </ol>
                <p className="mt-3 text-blue-600 text-xs">
                  📌 First time? Visit <strong>/admin</strong> to set up the DB
                  and seed data.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── AUDIO SEARCH ── */}
        {tab === "audio" && (
          <>
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Speak your query — e.g. <em>"gaming laptop under 1 lakh"</em> or{" "}
                <em>"best camera phone under 30k"</em>. Your voice is
                transcribed and then searched.
              </p>

              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={audioLoading}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-md transition-all ${
                    recording
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : "bg-blue-600 hover:bg-blue-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                >
                  {recording ? "⏹" : "🎤"}
                </button>
                <p className="text-sm text-gray-500">
                  {audioLoading
                    ? "Transcribing and searching…"
                    : recording
                      ? "Recording… tap to stop"
                      : "Tap to record"}
                </p>
              </div>
            </div>

            {audioError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
                {audioError}
              </div>
            )}

            {audioLoading && (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border p-5 animate-pulse"
                  >
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {audioSearched && !audioLoading && (
              <div>
                {/* Transcription card */}
                {transcription && (
                  <div className="bg-gray-50 border rounded-lg p-4 mb-4 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-700">Heard:</span>
                      {transcriptionSource === "huggingface" && (
                        <Badge label="HuggingFace Whisper" color="blue" />
                      )}
                    </div>
                    <p className="text-gray-800 italic">"{transcription}"</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detectedCategory && detectedCategory !== "all" && (
                        <Badge
                          label={`Category: ${detectedCategory}`}
                          color="gray"
                        />
                      )}
                      {detectedPrice !== undefined && (
                        <Badge
                          label={`Max: ₹${detectedPrice.toLocaleString("en-IN")}`}
                          color="gray"
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <p className="text-sm text-gray-500">
                    {audioResults.length === 0
                      ? "No results found."
                      : `${audioResults.length} result${audioResults.length !== 1 ? "s" : ""} found`}
                  </p>
                  {audioMode === "semantic" && (
                    <Badge label="Semantic search" color="blue" />
                  )}
                  {audioMode === "fulltext" && (
                    <Badge label="Full-text search" color="yellow" />
                  )}
                </div>

                <div className="grid gap-4">
                  {audioResults.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              </div>
            )}

            {!audioSearched && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800">
                <p className="font-semibold mb-2">How audio search works</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Audio → transcribed via HuggingFace Whisper large-v3</li>
                  <li>
                    Category and price filters extracted from spoken words
                  </li>
                  <li>
                    Text query searched semantically via Ollama / HuggingFace
                    (or full-text as last resort)
                  </li>
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
