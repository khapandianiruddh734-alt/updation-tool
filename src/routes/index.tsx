import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { UploadStep } from "@/components/UploadStep";
import { PreviewStep } from "@/components/PreviewStep";
import { CompareStep } from "@/components/CompareStep";
import { DownloadStep } from "@/components/DownloadStep";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Menu Price Comparator Pro — Team Edition" },
      {
        name: "description",
        content:
          "Compare and update menu prices from text/Excel/CSV menus into Swiggy/Zomato CSV exports. Variation-aware, format-preserving.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState("upload");
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <header className="border-b px-6 py-4">
          <h1 className="text-xl md:text-2xl font-bold">
            🍽️ Menu Price Comparator Pro
          </h1>
          <p className="text-sm text-muted-foreground">
            Update Swiggy/Zomato CSV prices from your source menu — variation-aware, structure-preserving.
          </p>
        </header>
        <div className="p-6 max-w-6xl">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-6">
              <TabsTrigger value="upload">1. Upload</TabsTrigger>
              <TabsTrigger value="preview">2. Preview</TabsTrigger>
              <TabsTrigger value="compare">3. Compare</TabsTrigger>
              <TabsTrigger value="download">4. Download</TabsTrigger>
            </TabsList>
            <TabsContent value="upload">
              <UploadStep onNext={() => setTab("preview")} />
            </TabsContent>
            <TabsContent value="preview">
              <PreviewStep onNext={() => setTab("compare")} />
            </TabsContent>
            <TabsContent value="compare">
              <CompareStep onNext={() => setTab("download")} />
            </TabsContent>
            <TabsContent value="download">
              <DownloadStep />
            </TabsContent>
          </Tabs>
        </div>
        <Toaster />
      </main>
    </div>
  );
}
