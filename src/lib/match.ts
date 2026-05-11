import Fuse from "fuse.js";
import { normalize } from "./normalize";
import type { SourceItem } from "./types";

export type MatchResult = {
  item: SourceItem | null;
  score: number; // 0-100
  multiple: boolean;
};

const PROTEINS = [
  "chicken",
  "mutton",
  "fish",
  "prawn",
  "prawns",
  "egg",
  "paneer",
  "veg",
  "veggie",
  "vegetable",
  "lamb",
  "beef",
  "pork",
];

function extractProtein(name: string): string | null {
  const n = ` ${name.toLowerCase()} `;
  for (const p of PROTEINS) {
    if (n.includes(` ${p} `)) {
      // normalize synonyms
      if (p === "prawns") return "prawn";
      if (p === "veggie" || p === "vegetable") return "veg";
      return p;
    }
  }
  // "non veg" / "non-veg" — treat absence of explicit protein as null
  return null;
}

function proteinsCompatible(a: string, b: string): boolean {
  const pa = extractProtein(a);
  const pb = extractProtein(b);
  // If both have an explicit protein, they MUST match.
  if (pa && pb) return pa === pb;
  // If only one side declares a protein, treat as incompatible to avoid
  // matching "Chicken Soup" with generic "Soup".
  if (pa !== pb) return false;
  return true;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

export function buildMatcher(items: SourceItem[]) {
  const indexed = items.map((it) => ({
    ...it,
    _norm: normalize(it.name),
    _protein: extractProtein(it.name),
    _tokens: tokenSet(it.name),
  }));

  // exact-name lookup
  const exactByRaw = new Map<string, SourceItem>();
  const exactByNorm = new Map<string, SourceItem>();
  indexed.forEach((it) => {
    exactByRaw.set(it.name.trim().toLowerCase(), it);
    if (it._norm) exactByNorm.set(it._norm, it);
  });

  const fuse = new Fuse(indexed, {
    keys: ["_norm", "name"],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  return (query: string, threshold: number): MatchResult => {
    if (!query) return { item: null, score: 0, multiple: false };

    // 1) Exact match (raw, then normalized)
    const exact =
      exactByRaw.get(query.trim().toLowerCase()) ||
      exactByNorm.get(normalize(query));
    if (exact) {
      // still verify protein compatibility (it will, since names are equal)
      return { item: exact, score: 100, multiple: false };
    }

    const qNorm = normalize(query);
    if (!qNorm) return { item: null, score: 0, multiple: false };
    const qTokens = tokenSet(query);

    // 2) Fuzzy candidates filtered by protein compatibility
    const results = fuse.search(qNorm);
    const filtered = results.filter((r) => proteinsCompatible(query, r.item.name));
    if (!filtered.length) return { item: null, score: 0, multiple: false };

    // 3) Re-rank by token Jaccard similarity (identifying words must overlap)
    const ranked = filtered
      .map((r) => {
        const fuseScore = Math.round((1 - (r.score ?? 1)) * 100);
        const inter = [...qTokens].filter((t) => r.item._tokens.has(t)).length;
        const union = new Set([...qTokens, ...r.item._tokens]).size || 1;
        const jaccard = Math.round((inter / union) * 100);
        // Require at least one shared identifying token
        const combined = inter === 0 ? 0 : Math.round(fuseScore * 0.4 + jaccard * 0.6);
        return { item: r.item, score: combined };
      })
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) return { item: null, score: 0, multiple: false };
    const best = ranked[0];
    const close = ranked.filter((r) => r.score >= best.score - 5);
    return { item: best.item, score: best.score, multiple: close.length > 1 };
  };
}
