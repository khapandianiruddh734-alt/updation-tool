import type { VariationRules } from "./types";

export function isParentRow(price: number, variation: string, itemType: string) {
  const v = (variation || "").trim().toLowerCase();
  const t = (itemType || "").trim().toLowerCase();
  // Strict parent row detection:
  // - Price is 0, OR
  // - No variation specified, OR  
  // - Variation is "item" or similar parent indicator, OR
  // - Item type is "item"
  return price === 0 || v === "" || v === "item" || t === "item";
}

// Extract portion type from item name (e.g., "Kadhi Half" -> "half")
export function extractPortionFromName(name: string): string | null {
  const n = name.toLowerCase();
  const portions = ["half", "full", "small", "large", "regular", "6 pcs", "6pcs", "12 pcs", "12pcs", "with ice cream"];
  for (const p of portions) {
    if (n.includes(p)) return p.toLowerCase();
  }
  return null;
}

// Get portion size order for intelligent mapping (lower value = smaller portion)
function getPortionOrder(portion: string): number {
  const order: Record<string, number> = {
    "6pcs": 1,
    "6 pcs": 1,
    "half": 2,
    "small": 2,
    "regular": 3,
    "full": 4,
    "large": 4,
    "12pcs": 5,
    "12 pcs": 5,
    "with ice cream": 6,
  };
  return order[portion.toLowerCase()] ?? 99;
}

// Check if a price fits better with a specific variation based on portion size
export function shouldApplyVariationPrice(
  sourceName: string,
  sourcePrice: number,
  targetVariation: string,
  basePrice: number
): boolean {
  const sourcePortionType = extractPortionFromName(sourceName);
  const targetPortionType = targetVariation.toLowerCase();
  
  if (!sourcePortionType) return true; // No source portion info, apply as usual
  
  const sourceOrder = getPortionOrder(sourcePortionType);
  const targetOrder = getPortionOrder(targetPortionType);
  
  // If source and target portion types match or are in the same order, apply it
  if (sourceOrder === targetOrder) return true;
  
  // Don't apply if portions don't logically match
  return false;
}

export function computeVariationPrice(
  basePrice: number,
  variation: string,
  rules: VariationRules,
): number {
  const v = variation.toLowerCase();
  if (!v || v === "full" || v === "regular" || v === "12 pcs" || v === "12pcs")
    return basePrice;
  if (v === "half") return Math.round((basePrice * rules.half) / 100);
  if (v === "small") return Math.round((basePrice * rules.small) / 100);
  if (v === "large") return Math.round((basePrice * rules.large) / 100);
  if (v === "6 pcs" || v === "6pcs")
    return Math.round((basePrice * rules.sixPcs) / 100);
  if (v.includes("ice cream")) return basePrice + rules.withIceCream;
  return basePrice;
}
