const COMMON_TYPOS: Record<string, string> = {
  patato: "potato",
  panner: "paneer",
  chinesse: "chinese",
  tandori: "tandoori",
  tanduri: "tandoori",
  gril: "grill",
  chessis: "cheese",
  allu: "aloo",
  malyi: "malai",
  sous: "sauce",
  toping: "topping",
  sidu: "siddu",
  metha: "meetha",
  champ: "chaap",
  "form house": "farm house",
};

const EXCLUDE_WORDS = new Set([
  "with",
  "and",
  "sauce",
  "special",
  "new",
  "combo",
]);

const VARIATION_KEYWORDS = [
  "half",
  "full",
  "large",
  "small",
  "regular",
  "6 pcs",
  "12 pcs",
  "6pcs",
  "12pcs",
  "with ice cream",
];

export function normalize(name: string): string {
  if (!name) return "";
  let s = name.toLowerCase();
  // strip parentheses content
  s = s.replace(/\([^)]*\)/g, " ");
  // remove special chars
  s = s.replace(/[^a-z0-9\s]/g, " ");
  // replace typos (longest first)
  const keys = Object.keys(COMMON_TYPOS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    s = s.replace(new RegExp(`\\b${k}\\b`, "g"), COMMON_TYPOS[k]);
  }
  // remove variation keywords
  for (const v of VARIATION_KEYWORDS) {
    s = s.replace(new RegExp(`\\b${v}\\b`, "g"), " ");
  }
  // remove exclude words
  s = s
    .split(/\s+/)
    .filter((w) => w && !EXCLUDE_WORDS.has(w))
    .join(" ");
  return s.trim();
}

export function detectVariation(itemName: string, variation: string): string {
  const v = (variation || "").trim().toLowerCase();
  if (v && v !== "item") return v;
  const m = itemName.match(/\(([^)]+)\)/);
  if (m) return m[1].trim().toLowerCase();
  return "";
}
