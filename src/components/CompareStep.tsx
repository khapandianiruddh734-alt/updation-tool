import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSession } from "@/store/session";
import { buildMatcher } from "@/lib/match";
import { isParentRow } from "@/lib/variations";
import { detectVariation, normalize } from "@/lib/normalize";
import { VariationMapper } from "@/lib/variation-mapper";
import type { CompareRow, ChangeLogEntry } from "@/lib/types";

function canonicalVariation(text: string): string {
  const value = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ")} `.replace(/\s+/g, " ");
  if (value.includes(" with ice cream ")) return "with ice cream";
  if (/\b12\s*pcs?\b/.test(value) || /\b12\s*pieces?\b/.test(value)) return "12 pcs";
  if (/\b10\s*pcs?\b/.test(value) || /\b10\s*pieces?\b/.test(value)) return "10 pcs";
  if (/\b8\s*pcs?\b/.test(value) || /\b8\s*pieces?\b/.test(value)) return "8 pcs";
  if (/\b6\s*pcs?\b/.test(value) || /\b6\s*pieces?\b/.test(value)) return "6 pcs";
  if (/\b4\s*pcs?\b/.test(value) || /\b4\s*pieces?\b/.test(value)) return "4 pcs";
  if (/\bhalf\b|\b1\s*2\b|\b50\b/.test(value)) return "half";
  if (/\bfull\b|\bwhole\b|\b100\b/.test(value)) return "full";
  if (/\bregular\b/.test(value)) return "regular";
  if (/\bsmall\b|\bmini\b/.test(value)) return "small";
  if (/\blarge\b|\bjumbo\b|\bfamily\b|\bparty\b/.test(value)) return "large";
  return "";
}

function targetVariationKey(itemName: string, variation: string): string {
  return canonicalVariation(variation) || canonicalVariation(itemName);
}

function sourceVariationKey(sourceName: string): string {
  return canonicalVariation(sourceName);
}

function variationPriceFromSource(
  sourceItems: ReturnType<typeof useSession>["sourceItems"],
  itemName: string,
  targetVariation: string,
): { price: number; sourceName: string } | null {
  const normalizedItemName = normalize(itemName);
  const candidates = sourceItems.filter(
    (item) => normalize(item.name).toLowerCase() === normalizedItemName.toLowerCase()
  );

  if (!candidates.length) return null;

  const targetKey = targetVariationKey(itemName, targetVariation);
  if (targetKey) {
    const exactVariation = candidates.find((candidate) => sourceVariationKey(candidate.name) === targetKey);
    if (!exactVariation) return null;
    return { price: exactVariation.price, sourceName: exactVariation.name };
  }

  const exactBase = candidates.find((candidate) => !sourceVariationKey(candidate.name));
  if (exactBase) return { price: exactBase.price, sourceName: exactBase.name };
  if (candidates.length === 1) return { price: candidates[0].price, sourceName: candidates[0].name };

  return null;
}

export function CompareStep({ onNext }: { onNext: () => void }) {
  const s = useSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "updated" | "no-match" | "parent">("all");

  // Run compare on mount / dep change
  useEffect(() => {
    const matcher = buildMatcher(s.sourceItems);
    const varMapper = new VariationMapper(s.rules);
    const changeLogEntries: ChangeLogEntry[] = [];

    // Count rows per item name to detect whether a "parent-looking" row
    // actually has variation children. Single-item rows (no children) must
    // be priced like normal items, not skipped as parents.
    const childCount = new Map<string, number>();
    s.csvRows.forEach((row) => {
      const name = (row[s.itemNameCol] || "").trim().toLowerCase();
      if (!name) return;
      const price = Number(row[s.priceCol] || 0);
      const variation = (row[s.variationCol] || "").trim().toLowerCase();
      const itemType = (row[s.itemTypeCol] || "").trim().toLowerCase();
      const isParent = isParentRow(price, variation, itemType);
      if (!isParent) childCount.set(name, (childCount.get(name) || 0) + 1);
    });

    const out: CompareRow[] = s.csvRows.map((row, i) => {
      const oldPrice = Number(row[s.priceCol] || 0);
      const itemName = row[s.itemNameCol] || "";
      const variation = detectVariation(itemName, row[s.variationCol] || "");
      const itemType = row[s.itemTypeCol] || "";
      const nameKey = itemName.trim().toLowerCase();
      const hasChildren = (childCount.get(nameKey) || 0) > 0;
      const itemId = row["Item ID"] || row["item_id"] || `row-${i + 2}`;

      if (isParentRow(oldPrice, row[s.variationCol] || "", itemType) && hasChildren) {
        // Log parent preservation
        if (s.changeLogEnabled) {
          changeLogEntries.push({
            id: "",
            timestamp: "",
            itemId,
            itemName,
            variation: "(parent)",
            oldPrice: 0,
            newPrice: 0,
            changeType: "parent_preserved",
            matchSource: "N/A",
            matchScore: 0,
            variationMapping: "N/A",
            userAction: "auto",
          });
        }

        return {
          rowIndex: i + 2,
          itemName,
          variation: "(parent)",
          oldPrice: 0,
          newPrice: 0,
          status: "parent",
          remarks: "📌 Parent row with variations - kept unchanged",
        };
      }

      const m = matcher(itemName, s.threshold);
      if (!m.item) {
        // Log no-match
        if (s.changeLogEnabled) {
          changeLogEntries.push({
            id: "",
            timestamp: "",
            itemId,
            itemName,
            variation,
            oldPrice,
            newPrice: oldPrice,
            changeType: "no_change",
            matchSource: "N/A",
            matchScore: 0,
            variationMapping: "N/A",
            userAction: "auto",
          });
        }

        return {
          rowIndex: i + 2,
          itemName,
          variation,
          oldPrice,
          newPrice: oldPrice,
          status: "no-match",
          remarks: "⚠️ No match found in source menu",
        };
      }

      const matchedSource = variationPriceFromSource(s.sourceItems, itemName, variation);
      if (!matchedSource) {
        if (s.changeLogEnabled) {
          changeLogEntries.push({
            id: "",
            timestamp: "",
            itemId,
            itemName,
            variation,
            oldPrice,
            newPrice: oldPrice,
            changeType: "no_change",
            matchSource: "N/A",
            matchScore: m.score,
            variationMapping: "No source price for this variation",
            userAction: "auto",
          });
        }

        return {
          rowIndex: i + 2,
          itemName,
          variation,
          oldPrice,
          newPrice: oldPrice,
          status: "unchanged",
          remarks: `No source price found for ${variation || "base item"} - kept unchanged`,
          matchedSource: m.item.name,
          matchScore: m.score,
        };
      }

      const sourceNameUsed = matchedSource.sourceName;
      const newPrice = matchedSource.price;
      const variationDisplay = varMapper.getVariationDisplayName(variation);
      const sourceVariationDisplay = varMapper.getVariationDisplayName("");

      // Determine change type
      let changeType: ChangeLogEntry["changeType"] = "no_change";
      let remarks = "";
      let finalNewPrice = newPrice;

      if (newPrice === oldPrice) {
        remarks = `✓ No price change | Matched: ${sourceNameUsed} | Variation: ${variationDisplay}`;
        changeType = "no_change";
      } else {
        remarks =
          m.multiple
            ? `⚠️ Multiple matches, used "${sourceNameUsed}" — Price updated: ₹${oldPrice} → ₹${newPrice} (${variationDisplay})`
            : `✓ Price updated: ₹${oldPrice} → ₹${newPrice} | Source: ${sourceNameUsed} (${sourceVariationDisplay}) → Target: ${variationDisplay}`;
        changeType = "price_update";
      }

      // Log the change
      if (s.changeLogEnabled) {
        changeLogEntries.push({
          id: "",
          timestamp: "",
          itemId,
          itemName,
          variation,
          oldPrice,
          newPrice: finalNewPrice,
          changeType,
          matchSource: sourceNameUsed,
          matchScore: m.score,
          variationMapping: `${sourceVariationDisplay} → ${variationDisplay}`,
          userAction: "auto",
        });
      }

      return {
        rowIndex: i + 2,
        itemName,
        variation,
        oldPrice,
        newPrice: finalNewPrice,
        status: finalNewPrice === oldPrice ? "unchanged" : m.multiple ? "multi-match" : "updated",
        remarks,
        matchedSource: sourceNameUsed,
        matchScore: m.score,
      };
    });

    // Add all change log entries to session
    changeLogEntries.forEach((entry) => {
      s.logChange({
        itemId: entry.itemId,
        itemName: entry.itemName,
        variation: entry.variation,
        oldPrice: entry.oldPrice,
        newPrice: entry.newPrice,
        changeType: entry.changeType,
        matchSource: entry.matchSource,
        matchScore: entry.matchScore,
        variationMapping: entry.variationMapping,
        userAction: entry.userAction,
      });
    });

    s.set({ compare: out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.sourceItems, s.csvRows, s.priceCol, s.itemNameCol, s.variationCol, s.itemTypeCol, s.threshold, s.rules, s.changeLogEnabled]);

  const stats = useMemo(() => {
    const c = s.compare;
    return {
      total: c.length,
      updated: c.filter((r) => r.status === "updated" || r.status === "multi-match").length,
      unchanged: c.filter((r) => r.status === "unchanged").length,
      noMatch: c.filter((r) => r.status === "no-match").length,
      parents: c.filter((r) => r.status === "parent").length,
    };
  }, [s.compare]);

  const matchRate = stats.total
    ? Math.round(((stats.updated + stats.unchanged) / (stats.total - stats.parents || 1)) * 100)
    : 0;

  const filtered = s.compare.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (query && !`${r.itemName} ${r.variation}`.toLowerCase().includes(query.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Updated" value={stats.updated} tone="amber" />
        <StatCard label="Unchanged" value={stats.unchanged} tone="green" />
        <StatCard label="No match" value={stats.noMatch} tone="red" />
        <StatCard label="Match rate" value={`${matchRate}%`} tone="primary" />
      </div>

      {/* Change Log Summary */}
      {s.changeLog.length > 0 && (
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <span>📝 Change Log ({s.changeLog.length} entries)</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="p-4 mt-2">
              <div className="space-y-3">
                <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Price Updated</div>
                    <div className="text-lg font-semibold text-amber-600">
                      {s.changeLog.filter((e) => e.changeType === "price_update").length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">No Change</div>
                    <div className="text-lg font-semibold text-green-600">
                      {s.changeLog.filter((e) => e.changeType === "no_change").length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Parent Preserved</div>
                    <div className="text-lg font-semibold text-blue-600">
                      {s.changeLog.filter((e) => e.changeType === "parent_preserved").length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">No Match Found</div>
                    <div className="text-lg font-semibold text-rose-600">
                      {s.changeLog.filter((e) => e.matchScore === 0 && e.changeType !== "parent_preserved").length}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="text-xs font-semibold mb-2">Change Log Entries (Latest First)</div>
                  <div className="max-h-[15rem] overflow-auto border rounded-md bg-muted/30">
                    <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Variation</TableHead>
                          <TableHead className="text-right">Old</TableHead>
                          <TableHead className="text-right">New</TableHead>
                          <TableHead>Mapping</TableHead>
                          <TableHead className="text-right">Match %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...s.changeLog].reverse().map((entry) => (
                          <TableRow key={entry.id} className="text-xs">
                            <TableCell>{entry.timestamp}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{entry.itemName}</TableCell>
                            <TableCell>{entry.variation || "—"}</TableCell>
                            <TableCell className={`text-right ${entry.changeType === "price_update" ? "bg-yellow-200 dark:bg-yellow-900 font-semibold" : ""}`}>{entry.oldPrice || "—"}</TableCell>
                            <TableCell className={`text-right font-semibold ${entry.changeType === "price_update" ? "bg-yellow-200 dark:bg-yellow-900" : ""}`}>{entry.newPrice || "—"}</TableCell>
                            <TableCell className="text-xs">{entry.variationMapping}</TableCell>
                            <TableCell className="text-right">{entry.matchScore}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const csv = [
                        ["Timestamp", "Item ID", "Item Name", "Variation", "Old Price", "New Price", "Change Type", "Match Source", "Match %", "Variation Mapping"],
                        ...s.changeLog.map((e) => [
                          e.timestamp,
                          e.itemId,
                          e.itemName,
                          e.variation,
                          e.oldPrice,
                          e.newPrice,
                          e.changeType,
                          e.matchSource,
                          e.matchScore,
                          e.variationMapping,
                        ]),
                      ]
                        .map((row) => row.map((cell) => `"${cell}"`).join(","))
                        .join("\n");
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                      link.download = `change_log_${new Date().toISOString().slice(0, 10)}.csv`;
                      link.click();
                    }}
                  >
                    📥 Download Change Log (CSV)
                  </Button>
                </div>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Input
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-1">
            {(["all", "updated", "no-match", "parent"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="max-h-[28rem] overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Variation</TableHead>
                <TableHead className="text-right">Old</TableHead>
                <TableHead className="text-right">New</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 500).map((r) => (
                <TableRow key={r.rowIndex} className={rowClass(r.status)}>
                  <TableCell className="text-xs text-muted-foreground">{r.rowIndex}</TableCell>
                  <TableCell className="font-medium">{r.itemName}</TableCell>
                  <TableCell>{r.variation}</TableCell>
                  <TableCell className={`text-right ${getPriceHighlight(r.status)}`}>{r.oldPrice || "—"}</TableCell>
                  <TableCell className={`text-right font-semibold ${getPriceHighlight(r.status)}`}>
                    {r.newPrice || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.remarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 500 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Showing 500 of {filtered.length} rows. Use search/filter to narrow.
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={onNext}>
          Continue to Download →
        </Button>
      </div>
    </div>
  );
}

function getPriceHighlight(status: CompareRow["status"]) {
  if (status === "updated" || status === "multi-match") {
    return "bg-yellow-200 dark:bg-yellow-900 font-semibold";
  }
  return "";
}

function rowClass(status: CompareRow["status"]) {
  switch (status) {
    case "updated":
    case "multi-match":
      return "bg-amber-50 dark:bg-amber-950/30";
    case "unchanged":
      return "bg-emerald-50 dark:bg-emerald-950/30";
    case "no-match":
      return "bg-rose-50 dark:bg-rose-950/30";
    default:
      return "";
  }
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "amber" | "green" | "red" | "primary";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600"
      : tone === "green"
        ? "text-emerald-600"
        : tone === "red"
          ? "text-rose-600"
          : tone === "primary"
            ? "text-primary"
            : "";
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </Card>
  );
}
