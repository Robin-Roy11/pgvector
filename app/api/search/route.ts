import type { NextRequest } from "next/server";
import { searchProducts } from "@/lib/db";
import { parseFilters } from "@/lib/parseFilters";
import { parseSpecRequirements } from "@/lib/parseSpecs";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  if (!q) {
    return Response.json({ results: [], message: "Enter a search query" });
  }

  // Parse category, price ceiling, and spec requirements directly from the query text.
  // The UI no longer exposes separate filter controls — everything comes from natural language.
  const { category, maxPrice } = parseFilters(q);
  const specReqs = parseSpecRequirements(q);

  try {
    const { results, mode } = await searchProducts(q, category, maxPrice, specReqs);
    return Response.json({ results, mode, category, maxPrice: maxPrice < 999999 ? maxPrice : undefined });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json({ results: [], error: String(error) }, { status: 500 });
  }
}
