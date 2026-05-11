import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSession } from "@/store/session";
import { isParentRow } from "@/lib/variations";

export function PreviewStep({ onNext }: { onNext: () => void }) {
  const s = useSession();

  const parents = s.csvRows.filter((r) =>
    isParentRow(
      Number(r[s.priceCol] || 0),
      r[s.variationCol] || "",
      r[s.itemTypeCol] || "",
    ),
  ).length;
  const variations = s.csvRows.length - parents;

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-3">CSV Column Mapping</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <ColSel label="Item Name" value={s.itemNameCol} onChange={(v) => s.set({ itemNameCol: v })} options={s.csvHeaders} />
          <ColSel label="Variation" value={s.variationCol} onChange={(v) => s.set({ variationCol: v })} options={s.csvHeaders} />
          <ColSel label="Price" value={s.priceCol} onChange={(v) => s.set({ priceCol: v })} options={s.csvHeaders} />
          <ColSel label="Item Type" value={s.itemTypeCol} onChange={(v) => s.set({ itemTypeCol: v })} options={s.csvHeaders} />
        </div>
        <div className="mt-4 flex gap-3 text-sm">
          <Stat label="Total rows" value={s.csvRows.length} />
          <Stat label="Parent rows" value={parents} />
          <Stat label="Variation rows" value={variations} />
          <Stat label="Source items" value={s.sourceItems.length} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Source items (first 20)</h3>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.sourceItems.slice(0, 20).map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{it.name}</TableCell>
                    <TableCell className="text-right">₹{it.price}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Target CSV (first 10)</h3>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {s.csvHeaders.slice(0, 6).map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.csvRows.slice(0, 10).map((r, i) => (
                  <TableRow key={i}>
                    {s.csvHeaders.slice(0, 6).map((h) => (
                      <TableCell key={h} className="max-w-40 truncate">
                        {r[h]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!s.priceCol || !s.itemNameCol}
          onClick={onNext}
        >
          Run Comparison →
        </Button>
      </div>
    </div>
  );
}

function ColSel({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
