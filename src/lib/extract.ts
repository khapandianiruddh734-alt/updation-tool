import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { SourceItem } from "./types";

const PRICE_PATTERNS = [
  /^([A-Z][A-Z\s&'\-()]+?)\s+(\d{2,5})\/-?\s*$/,
  /^([A-Z][A-Z\s&'\-()]+?)\s+₹\s*(\d{2,5})\s*$/,
  /^([A-Z][A-Z\s&'\-()]+?)\s+(\d{2,5})\s*$/,
  /^([A-Z][A-Z\s&'\-()]+?)\s*[-–]\s*₹?\s*(\d{2,5})\s*$/,
  /^\d+[).\]]?\s*([A-Z][A-Z\s&'\-()]+?)\s+₹?\s*(\d{2,5})\s*$/,
];

const CATEGORY_PRICE_PATTERN =
  /^([A-Z][A-Z\s&'\-()]+?)\s*(?:@|at)\s*(?:rs\.?|inr|â‚¹)?\s*(\d{1,5})\s*$/i;

const SKIP_CATEGORY_LINES = new Set([
  "add on",
  "add ons",
  "addon",
  "addons",
  "extra",
  "extras",
]);

export function extractFromText(text: string): SourceItem[] {
  const lines = text.split(/\r?\n/);
  const items: SourceItem[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 3) continue;
    for (const re of PRICE_PATTERNS) {
      const m = line.match(re);
      if (m) {
        const groups = m.slice(1);
        const name = groups[groups.length - 2]?.trim();
        const price = parseInt(groups[groups.length - 1] ?? "0", 10);
        if (name && price > 0 && price < 100000) {
          items.push({ name, price });
        }
        break;
      }
    }
  }
  items.push(...extractCategoryItems(lines));
  // dedupe
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = it.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractCategoryItems(lines: string[]): SourceItem[] {
  const items: SourceItem[] = [];
  let blockName = "";
  let blockPrice = 0;
  let groupName = "";

  for (const raw of lines) {
    const line = cleanMenuLine(raw);
    if (!line) continue;

    const pricedCategory = line.match(CATEGORY_PRICE_PATTERN);
    if (pricedCategory) {
      blockName = toTitleCase(pricedCategory[1]);
      blockPrice = Number(pricedCategory[2]);
      groupName = "";
      continue;
    }

    if (!blockPrice || isNoiseLine(line)) continue;

    if (looksLikeGroupHeading(line, blockName, groupName)) {
      groupName = toTitleCase(line);
      items.push({ name: groupName, price: blockPrice });
      continue;
    }

    if (groupName) {
      items.push({
        name: `${toTitleCase(line)} ${groupName}`,
        price: blockPrice,
      });
    }
  }

  return items;
}

function cleanMenuLine(value: string): string {
  return value
    .replace(/[|,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseLine(line: string): boolean {
  const normalized = line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || SKIP_CATEGORY_LINES.has(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (normalized.length < 3) return true;
  return false;
}

function looksLikeGroupHeading(line: string, blockName: string, currentGroup: string): boolean {
  const normalizedLine = line.toLowerCase();
  const blockTokens = blockName
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);

  if (blockTokens.some((token) => normalizedLine.includes(token))) return true;
  if (!currentGroup && line.split(/\s+/).length > 1) return true;
  return false;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function extractFromFile(file: File): Promise<SourceItem[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "txt") {
    return extractFromText(await file.text());
  }
  if (ext === "csv") {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return rowsToItems(parsed.data);
  }
  if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const items: SourceItem[] = [];
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[sn],
      );
      items.push(...rowsToItems(rows));
      // also try raw text for non-tabular sheets
      const aoa = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
      items.push(...extractFromText(aoa));
    }
    const seen = new Set<string>();
    return items.filter((it) => {
      const k = it.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  throw new Error(`Unsupported source format: .${ext}`);
}

function rowsToItems(rows: Array<Record<string, unknown>>): SourceItem[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const nameKey = headers.find((h) =>
    /(item|product|name|dish)/i.test(h),
  );
  const priceKey = headers.find((h) => /(price|rate|amount|mrp|cost)/i.test(h));
  if (!nameKey || !priceKey) return [];
  const out: SourceItem[] = [];
  for (const r of rows) {
    const name = String(r[nameKey] ?? "").trim();
    const priceRaw = String(r[priceKey] ?? "").replace(/[^0-9.]/g, "");
    const price = parseFloat(priceRaw);
    if (name && price > 0) out.push({ name, price: Math.round(price) });
  }
  return out;
}

export async function readCsv(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, string>[]; delimiter: string }> {
  const text = await file.text();
  // delimiter detection
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >
    (firstLine.match(/,/g)?.length ?? 0)
    ? ";"
    : ",";
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  });
  const headers = parsed.meta.fields ?? [];
  return { headers, rows: parsed.data, delimiter };
}
