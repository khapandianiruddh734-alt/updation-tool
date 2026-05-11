import type { VariationRules } from "./types";
import { computeVariationPrice } from "./variations";

/**
 * VariationMapper - Intelligently maps variations between source and target
 * Examples:
 *   - HALF (₹200) → 4 PCS: Calculate based on price logic
 *   - FULL (₹400) → 8 PCS: Apply multiplier
 *   - Detects variation types from text (half, small, large, 4pcs, 6pcs, 8pcs, 12pcs, full)
 */
export class VariationMapper {
  private rules: VariationRules;

  // Define variation type categories with keywords
  private sizeMappings: Record<string, string[]> = {
    // Size descriptors
    small: ["small", "mini", "regular", "compact", "regular size"],
    medium: ["medium", "standard", "normal"],
    large: ["large", "jumbo", "family", "party"],

    // Piece count mappings
    half: ["half", "1/2", "50%", "half size", "4 pcs", "4pc", "4 pieces"],
    full: ["full", "whole", "100%", "8 pcs", "8pc", "8 pieces", "12 pcs", "12pc", "12 pieces"],
    sixPcs: ["6 pcs", "6pc", "6 pieces", "6pcs"],
    fourPcs: ["4 pcs", "4pc", "4 pieces", "4pcs"],
    eightPcs: ["8 pcs", "8pc", "8 pieces", "8pcs"],
    tenPcs: ["10 pcs", "10pc", "10 pieces", "10pcs"],
    twelvePcs: ["12 pcs", "12pc", "12 pieces", "12pcs"],
  };

  // Price multipliers for variations (as % of full price)
  private multipliers: Record<string, number> = {
    half: 0.55,
    small: 0.65,
    medium: 0.8,
    large: 1.15,
    fourPcs: 0.4,
    sixPcs: 0.6,
    eightPcs: 0.8,
    tenPcs: 1.0,
    twelvePcs: 1.2,
    full: 1.0,
  };

  constructor(rules?: VariationRules) {
    if (rules) {
      this.rules = rules;
      // Sync multipliers with rules
      this.multipliers.half = rules.half / 100;
      this.multipliers.small = rules.small / 100;
      this.multipliers.large = rules.large / 100;
      this.multipliers.sixPcs = rules.sixPcs / 100;
    } else {
      this.rules = {
        half: 55,
        small: 65,
        large: 115,
        sixPcs: 60,
        withIceCream: 25,
      };
    }
  }

  /**
   * Detect what type of variation this is
   */
  detectVariationType(
    variationText: string | undefined | null,
    itemName: string = "",
  ): string {
    if (!variationText || variationText.trim() === "") {
      variationText = "";
    }

    const combined = `${variationText} ${itemName}`.toLowerCase();

    // Check each variation category
    for (const [varType, keywords] of Object.entries(this.sizeMappings)) {
      for (const keyword of keywords) {
        if (combined.includes(keyword)) {
          return varType;
        }
      }
    }

    return "full"; // Default to full if no variation detected
  }

  /**
   * Extract base item name (remove variation indicators)
   */
  getParentBaseName(itemName: string, variation: string = ""): string {
    let name = itemName.toLowerCase();

    // Remove variation in parentheses
    name = name.replace(/\s*\([^)]+\)/g, "");

    // Remove variation word from the variation column too
    if (variation) {
      const cleanVariation = variation.toLowerCase().trim();
      for (const keywords of Object.values(this.sizeMappings)) {
        for (const keyword of keywords) {
          name = name.replace(new RegExp(`\\b${keyword}\\b`, "g"), "");
        }
      }
    }

    // Clean up multiple spaces and trim
    name = name.replace(/\s+/g, " ").trim();

    return name;
  }

  /**
   * Map price from source variation to target variation
   * Example: Source has HALF (₹200), Target has 4 PCS → calculate accordingly
   */
  mapVariationPrice(
    basePrice: number,
    sourceVariation: string | undefined | null,
    targetVariation: string | undefined | null,
  ): number {
    const sourceType = this.detectVariationType(sourceVariation);
    const targetType = this.detectVariationType(targetVariation);

    // Get multipliers for source and target
    const sourceMult = this.multipliers[sourceType] || 1.0;
    const targetMult = this.multipliers[targetType] || 1.0;

    // Calculate base price (what FULL/100% would be)
    let fullPrice = basePrice;
    if (sourceMult > 0) {
      fullPrice = basePrice / sourceMult;
    }

    // Calculate target price
    let targetPrice = fullPrice * targetMult;

    // Round to nearest 5 for nice pricing
    targetPrice = Math.round(targetPrice / 5) * 5;

    return Math.round(targetPrice);
  }

  /**
   * Get variation type for display/logging
   */
  getVariationDisplayName(variation: string | undefined | null): string {
    const type = this.detectVariationType(variation);
    const labels: Record<string, string> = {
      half: "HALF",
      full: "FULL",
      small: "SMALL",
      medium: "MEDIUM",
      large: "LARGE",
      fourPcs: "4 PCS",
      sixPcs: "6 PCS",
      eightPcs: "8 PCS",
      tenPcs: "10 PCS",
      twelvePcs: "12 PCS",
    };
    return labels[type] || variation?.toUpperCase() || "FULL";
  }

  /**
   * Compute new price for a variation (wrapper around computeVariationPrice)
   */
  computePrice(basePrice: number, variation: string | undefined | null): number {
    const variationStr = (variation || "").toLowerCase();

    // Handle specific cases
    if (!variationStr || variationStr === "full" || variationStr === "regular" || variationStr === "12 pcs" || variationStr === "12pcs") {
      return basePrice;
    }
    if (variationStr === "half") {
      return Math.round((basePrice * this.rules.half) / 100);
    }
    if (variationStr === "small") {
      return Math.round((basePrice * this.rules.small) / 100);
    }
    if (variationStr === "large") {
      return Math.round((basePrice * this.rules.large) / 100);
    }
    if (variationStr === "6 pcs" || variationStr === "6pcs") {
      return Math.round((basePrice * this.rules.sixPcs) / 100);
    }
    if (variationStr.includes("ice cream")) {
      return basePrice + this.rules.withIceCream;
    }

    return basePrice;
  }
}
