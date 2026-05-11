import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, FileSpreadsheet, X } from "lucide-react";
import { useSession } from "@/store/session";
import { extractFromFile, readCsv } from "@/lib/extract";
import { toast } from "sonner";

function detectColumn(headers: string[], patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = headers.find((h) => re.test(h));
    if (m) return m;
  }
  return "";
}

export function UploadStep({ onNext }: { onNext: () => void }) {
  const s = useSession();

  const onSource = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      try {
        const items = await extractFromFile(file);
        s.set({ sourceFile: file, sourceItems: items });
        toast.success(`Extracted ${items.length} items from ${file.name}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [s],
  );

  const onCsv = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      try {
        const { headers, rows, delimiter } = await readCsv(file);
        const priceCol = detectColumn(headers, [/^price$/i, /price/i]);
        const variationCol = detectColumn(headers, [/^variation$/i, /variant/i]);
        const itemNameCol = detectColumn(headers, [/^item\s*name$/i, /item/i, /name/i]);
        const itemTypeCol = detectColumn(headers, [/^item\s*type$/i, /type/i]);
        s.set({
          csvFile: file,
          csvHeaders: headers,
          csvRows: rows,
          csvDelimiter: delimiter,
          priceCol,
          variationCol,
          itemNameCol,
          itemTypeCol,
        });
        toast.success(`Loaded ${rows.length} rows from ${file.name}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [s],
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Dropzone
        title="Source Menu"
        subtitle=".txt, .csv, .xlsx, .xls"
        accept={{
          "text/plain": [".txt"],
          "text/csv": [".csv"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          "application/vnd.ms-excel": [".xls"],
        }}
        file={s.sourceFile}
        info={s.sourceFile ? `${s.sourceItems.length} items extracted` : null}
        onClear={() => s.set({ sourceFile: null, sourceItems: [] })}
        onDrop={onSource}
        icon={<FileText className="h-8 w-8" />}
      />
      <Dropzone
        title="Target CSV (Swiggy/Zomato)"
        subtitle=".csv"
        accept={{ "text/csv": [".csv"] }}
        file={s.csvFile}
        info={
          s.csvFile
            ? `${s.csvRows.length} rows · ${s.csvHeaders.length} columns · "${s.csvDelimiter}"`
            : null
        }
        onClear={() =>
          s.set({ csvFile: null, csvRows: [], csvHeaders: [], priceCol: "" })
        }
        onDrop={onCsv}
        icon={<FileSpreadsheet className="h-8 w-8" />}
      />
      <div className="md:col-span-2 flex justify-end">
        <Button
          size="lg"
          disabled={!s.sourceFile || !s.csvFile}
          onClick={onNext}
        >
          Continue to Preview →
        </Button>
      </div>
    </div>
  );
}

function Dropzone({
  title,
  subtitle,
  accept,
  file,
  info,
  onDrop,
  onClear,
  icon,
}: {
  title: string;
  subtitle: string;
  accept: Record<string, string[]>;
  file: File | null;
  info: string | null;
  onDrop: (f: File[]) => void;
  onClear: () => void;
  icon: React.ReactNode;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple: false,
    onDrop,
    maxSize: 50 * 1024 * 1024,
  });
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        {file && (
          <Button variant="ghost" size="icon" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {file ? (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            {icon}
            <div className="min-w-0">
              <div className="font-medium truncate">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · {info}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Drop here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
      )}
    </Card>
  );
}
