export interface SpecRequirements {
  brand?: string;       // e.g. "samsung", "apple"
  ram?: string;         // e.g. "8GB"
  storage?: string;     // e.g. "512GB", "1TB"
  gpu?: string;         // e.g. "rtx 4060", "dedicated"
  processor?: string;   // e.g. "snapdragon", "m2", "ryzen 5"
  camera?: string;      // e.g. "200" (MP)
  display?: string;     // e.g. "144hz", "oled", "amoled"
  battery?: string;     // e.g. "5000" (mAh) or "18" (hours)
  maxWeight?: number;   // in kg — for thin/light/portable queries
}

// All brands present in seed data, ordered longest-first to avoid partial matches
const KNOWN_BRANDS = [
  "oneplus", "motorola", "realme", "samsung", "nothing", "xiaomi",
  "lenovo", "google", "apple", "asus", "dell", "poco", "iqoo",
  "acer", "msi", "redmi", "hp",
];

export function parseSpecRequirements(text: string): SpecRequirements {
  const lower = text.toLowerCase();
  const reqs: SpecRequirements = {};

  // ── Brand ───────────────────────────────────────────────────────────────
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`).test(lower)) {
      // "nothing" is a common English word — only treat as brand when used
      // alongside a product noun or at sentence start
      if (brand === "nothing") {
        if (!/\bnothing\s+(phone|mobile|smartphone)\b/.test(lower)) continue;
      }
      reqs.brand = brand;
      break;
    }
  }

  // ── RAM ─────────────────────────────────────────────────────────────────
  const ramMatch = lower.match(
    /\b(\d+)\s*gb\s*(?:of\s*)?(?:ram|memory|ddr\d?)\b|\b(\d+)\s*gigs?\s*(?:of\s*)?(?:ram|memory)?\b/
  );
  if (ramMatch) reqs.ram = `${ramMatch[1] ?? ramMatch[2]}GB`;

  // ── Storage ─────────────────────────────────────────────────────────────
  const storageMatch = lower.match(
    /\b(\d+)\s*(gb|tb)\s*(?:ssd|nvme|storage|drive|hdd|internal)\b|\b(\d+)\s*tb\b/
  );
  if (storageMatch) {
    const num = storageMatch[1] ?? storageMatch[3];
    const unit = (storageMatch[2] ?? "tb").toUpperCase();
    const val = `${num}${unit}`;
    if (val !== reqs.ram) reqs.storage = val;
  }

  // ── GPU ─────────────────────────────────────────────────────────────────
  const gpuModelMatch = lower.match(
    /\brtx\s*(\d{4})\b|\bgtx\s*(\d{4})\b|\bradeon\s*rx\s*([\w\d]+)\b/
  );
  if (gpuModelMatch) {
    reqs.gpu = gpuModelMatch[0].replace(/\s+/g, " ").trim();
  } else if (
    /\b(nvidia|rtx|gtx|dedicated\s*(?:gpu|graphics)|gaming\s*(?:gpu|graphics))\b/.test(lower)
  ) {
    reqs.gpu = "dedicated";
  }

  // ── Processor ───────────────────────────────────────────────────────────
  const appleM = lower.match(/\bapple\s*(m[1-9])\b/);
  const intelCore = lower.match(/\bintel\s*(?:core\s*)?(i[3579][-\s]?\d+)/);
  const snapdragonNum = lower.match(/\bsnapdragon\s*(\d+(?:\s*gen\s*\d)?)\b/);
  const amdRyzen = lower.match(/\bamd\s*ryzen\s*(\d)/);
  const dimensity = lower.match(/\bdimensity\s*(\d+)/);

  if (appleM) reqs.processor = appleM[1];
  else if (intelCore) reqs.processor = intelCore[1].replace(/\s+/g, "-");
  else if (snapdragonNum) reqs.processor = `snapdragon ${snapdragonNum[1].replace(/\s+/g, " ").trim()}`;
  else if (amdRyzen) reqs.processor = `ryzen ${amdRyzen[1]}`;
  else if (dimensity) reqs.processor = `dimensity ${dimensity[1]}`;
  else if (/\bsnapdragon\b/.test(lower)) reqs.processor = "snapdragon";
  else if (/\bamd\s*ryzen\b/.test(lower)) reqs.processor = "ryzen";
  else if (/\bapple\s*(chip|silicon|m\s*chip)\b/.test(lower)) reqs.processor = "apple m";
  else if (/\bdimensity\b/.test(lower)) reqs.processor = "dimensity";

  // ── Camera ──────────────────────────────────────────────────────────────
  const mpMatch = lower.match(/\b(\d+)\s*mp\b/);
  if (mpMatch) reqs.camera = mpMatch[1];

  // ── Display ─────────────────────────────────────────────────────────────
  const hzMatch = lower.match(/\b(\d+)\s*hz\b/);
  if (hzMatch) reqs.display = hzMatch[1] + "hz";
  else if (/\bamoled\b/.test(lower)) reqs.display = "amoled";
  else if (/\boled\b/.test(lower)) reqs.display = "oled";

  // ── Battery: mAh (phones) or hours (laptops) ───────────────────────────
  const mAhMatch = lower.match(/\b(\d{4,5})\s*mah\b/);
  if (mAhMatch) {
    reqs.battery = mAhMatch[1];
  } else {
    const hoursMatch = lower.match(/\b(\d{1,2})\s*(?:hour|hr)s?\s*(?:battery|battery\s*life)?\b/);
    if (hoursMatch) reqs.battery = hoursMatch[1];
  }

  // ── Weight ──────────────────────────────────────────────────────────────
  const weightNumMatch = lower.match(
    /(?:under|below|less\s*than|lighter\s*than|max(?:imum)?)\s*(\d+(?:\.\d+)?)\s*kg\b/
  );
  if (weightNumMatch) {
    reqs.maxWeight = parseFloat(weightNumMatch[1]);
  } else if (/\b(thin|slim|light|lightweight|ultralight|portable)\b/.test(lower)) {
    reqs.maxWeight = 1.6;
  }

  return reqs;
}

export function matchesSpecRequirements(
  product: { brand: string; specs: Record<string, string> },
  requirements: SpecRequirements
): boolean {
  // ── Brand ───────────────────────────────────────────────────────────────
  if (requirements.brand) {
    if (!product.brand.toLowerCase().includes(requirements.brand)) return false;
  }

  // ── Weight (numeric comparison) ─────────────────────────────────────────
  if (requirements.maxWeight !== undefined) {
    const weightStr = product.specs.weight ?? "";
    const kg = parseFloat(weightStr);
    // Only reject if there IS a weight spec and it exceeds the limit
    if (!isNaN(kg) && kg > requirements.maxWeight) return false;
  }

  // ── Spec field checks ───────────────────────────────────────────────────
  const specKeys = [
    "ram", "storage", "gpu", "processor", "camera", "display", "battery",
  ] as const;

  for (const key of specKeys) {
    const req = requirements[key];
    if (!req) continue;
    const specVal = (product.specs[key] ?? "").toLowerCase();

    // GPU "dedicated" — just verify field exists
    if (key === "gpu" && req === "dedicated") {
      if (!specVal) return false;
      continue;
    }

    // "8GB" / "512GB" / "1TB"
    if (/^\d+(gb|tb)$/i.test(req)) {
      const num = req.match(/^(\d+)/)?.[1] ?? "";
      const unit = req.match(/(gb|tb)$/i)?.[1] ?? "";
      if (!new RegExp(`\\b${num}\\s*${unit}`, "i").test(specVal)) return false;

    // "144hz"
    } else if (/^\d+hz$/i.test(req)) {
      const num = req.replace(/hz$/i, "");
      if (!new RegExp(`\\b${num}\\s*hz`, "i").test(specVal)) return false;

    // Pure number (MP, mAh, battery hours)
    } else if (/^\d+$/.test(req)) {
      if (!new RegExp(`\\b${req}\\b`).test(specVal)) return false;

    // String fragment (processor name, display type, etc.)
    } else {
      if (!specVal.includes(req.toLowerCase())) return false;
    }
  }

  return true;
}
