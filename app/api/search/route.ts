import type { NextRequest } from "next/server";
import { searchProducts } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q") || "";
  const category = (searchParams.get("category") || "all") as
    | "laptop"
    | "mobile"
    | "all";
  const maxPrice = Number(searchParams.get("maxPrice") || "999999");

  if (!query.trim()) {
    return Response.json({ results: [], message: "Enter a search query" });
  }

  try {
    const results = await searchProducts(query, category, maxPrice);
    return Response.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json(
      { results: [], error: String(error) },
      { status: 500 }
    );
  }
}
