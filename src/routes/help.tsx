import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help - Menu Price Comparator" },
      { name: "description", content: "Format guide and source price matching rules." },
    ],
  }),
  component: Help,
});

function Help() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </Button>
      <h1 className="text-3xl font-bold">Help & Format Guide</h1>

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Supported source formats (web)</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li><b>.txt</b> - one item per line, e.g. <code>PANEER TIKKA 220</code> or <code>PANEER TIKKA Rs 220</code></li>
          <li><b>.csv</b> - must contain item-name and price columns (auto-detected)</li>
          <li><b>.xlsx / .xls</b> - any sheet; tabular or text patterns both work</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          For images, PDFs, and Word docs, use the downloadable Python script.
        </p>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Target CSV (Swiggy/Zomato)</h2>
        <p className="text-sm">
          Comma or semicolon delimited. Parent rows have <code>Price = 0</code> and are kept untouched.
          Variation rows are updated only when that exact variation price exists in the source menu.
        </p>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Variation pricing</h2>
        <p className="text-sm">
          The app does not calculate variation prices from percentage rules. For example, a Half row is
          updated only if the source menu contains a Half price for the same item. If the source menu only
          has a Full/base price, Half, Small, Large, 6 pcs, 12 pcs, and other variation rows stay unchanged.
        </p>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-xl font-semibold">Python script (OCR + PDF + Word)</h2>
        <p className="text-sm">
          For image/PDF/Word menus, download the script and run locally. Same matching logic, full openpyxl styling.
        </p>
        <Button asChild>
          <a href="/downloads/menu-comparator-python.zip" download>
            <Download className="h-4 w-4 mr-2" /> Download menu-comparator-python.zip
          </a>
        </Button>
      </Card>
    </div>
  );
}
