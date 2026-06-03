export function parseFilters(text: string): {
  category: "laptop" | "mobile" | "all";
  maxPrice: number;
} {
  // Strip commas inside number sequences (e.g. "1,50,000" → "150000", "50,000" → "50000")
  const lower = text.toLowerCase().replace(/\d[\d,]+\d/g, (m) => m.replace(/,/g, ""));

  // Category detection
  const isLaptop = /\b(laptop|laptops|notebook|notebooks|macbook|chromebook|ultrabook)\b/.test(lower);
  const isMobile = /\b(phone|phones|mobile|mobiles|smartphone|smartphones|iphone|android)\b/.test(lower);
  const isAll = /\b(all|both|everything|any)\b/.test(lower);

  let category: "laptop" | "mobile" | "all" = "all";
  if (isAll || (isLaptop && isMobile)) {
    category = "all";
  } else if (isLaptop) {
    category = "laptop";
  } else if (isMobile) {
    category = "mobile";
  }

  // Price extraction — matches patterns like:
  //   "under 50000", "below 50k", "less than 1.5 lakh", "max 30k",
  //   "up to ₹80000", "budget 30000", "₹50k", "50000 rupees"
  let maxPrice = 999999;

  const qualifiedMatch = lower.match(
    /\b(?:under|below|less\s+than|max(?:imum)?|upto|up\s+to|within|budget(?:\s+of)?)\s*[₹rs.]*\s*(\d+(?:\.\d+)?)\s*(k|lakh|lac|l|cr(?:ore)?)?/
  );
  const bareMatch =
    lower.match(/[₹]\s*(\d+(?:\.\d+)?)\s*(k|lakh|lac|l|cr(?:ore)?)?/) ||
    lower.match(/\b(\d+(?:\.\d+)?)\s*(k|lakh|lac)\b/);

  const m = qualifiedMatch || bareMatch;
  if (m) {
    const num = parseFloat(m[1]);
    const unit = (m[2] || "").toLowerCase();
    if (unit === "k") maxPrice = Math.round(num * 1000);
    else if (["lakh", "lac", "l"].includes(unit)) maxPrice = Math.round(num * 100000);
    else if (unit === "cr" || unit === "crore") maxPrice = Math.round(num * 10000000);
    else maxPrice = Math.round(num);
  }

  return { category, maxPrice };
}
