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
  // dedupe
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = it.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
