import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Code2 } from "lucide-react";
import { useSession } from "@/store/session";
import { buildComparisonCsv, buildStyledXlsx, buildUpdatedCsv } from "@/lib/excel";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadAsync(blobPromise: Promise<Blob>, name: string) {
  const blob = await blobPromise;
  download(blob, name);
}

export function DownloadStep() {
  const s = useSession();
  const baseName = s.csvFile?.name.replace(/\.[^.]+$/, "") || "menu";

  const updated = s.compare.filter(
    (r) => r.status === "updated" || r.status === "multi-match",
  ).length;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-2">Processing Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <Info label="Source items" value={s.sourceItems.length} />
          <Info label="CSV rows" value={s.csvRows.length} />
          <Info label="Prices updated" value={updated} />
          <Info label="Changes logged" value={s.changeLog.length} />
          <Info label="Session ID" value={s.sessionId} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          icon={<FileText className="h-8 w-8 text-emerald-600" />}
          title="Updated Target CSV"
          desc="Same CSV format and column order. Only price values are changed; remarks are inserted after Goods/Services."
          cta="Download CSV"
          onClick={() =>
            download(
              buildUpdatedCsv({
                headers: s.csvHeaders,
                rows: s.csvRows,
                compare: s.compare,
                priceCol: s.priceCol,
                delimiter: s.csvDelimiter,
              }),
              `${baseName}_updated.csv`,
            )
          }
        />
        <ActionCard
          icon={<FileSpreadsheet className="h-8 w-8 text-teal-600" />}
          title="Updated Excel (.xlsx)"
          desc="Excel copy with highlighted price changes and a Change Log sheet."
          cta="Download .xlsx"
          onClick={() =>
            downloadAsync(
              buildStyledXlsx({
                headers: s.csvHeaders,
                rows: s.csvRows,
                compare: s.compare,
                changeLog: s.changeLog,
                priceCol: s.priceCol,
              }),
              `${baseName}_updated.xlsx`,
            )
          }
        />
        <ActionCard
          icon={<FileText className="h-8 w-8 text-blue-600" />}
          title="Comparison Report (.csv)"
          desc="Full diff: item, variation, old price, new price, status, remarks."
          cta="Download report"
          onClick={() =>
            download(buildComparisonCsv(s.compare), `${baseName}_report.csv`)
          }
        />
        <ActionCard
          icon={<Code2 className="h-8 w-8 text-purple-600" />}
          title="Python Script (OCR + PDF)"
          desc="Run locally for image/PDF/Word menu support and full openpyxl styling. Zero setup beyond pip install."
          cta="Download script"
          onClick={() => {
            const a = document.createElement("a");
            a.href = "/downloads/menu-comparator-python.zip";
            a.download = "menu-comparator-python.zip";
            a.click();
          }}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="mb-3">{icon}</div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground flex-1 mb-4">{desc}</p>
      <Button onClick={onClick}>
        <Download className="h-4 w-4 mr-2" />
        {cta}
      </Button>
    </Card>
  );
}
