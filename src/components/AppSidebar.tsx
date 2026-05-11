import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useSession } from "@/store/session";
import { Link } from "@tanstack/react-router";
import { ChefHat, RotateCcw, HelpCircle } from "lucide-react";

export function AppSidebar() {
  const s = useSession();
  return (
    <aside className="w-72 shrink-0 border-r bg-card/30 p-4 space-y-4 hidden lg:block overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <ChefHat className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold leading-tight">Menu Comparator</div>
          <div className="text-xs text-muted-foreground">Team Edition</div>
        </div>
      </div>

      <Card className="p-3 text-xs space-y-1">
        <div className="text-muted-foreground">Session</div>
        <div className="font-mono">{s.sessionId}</div>
      </Card>

      <Separator />

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Match threshold: {s.threshold}</Label>
          <Slider
            min={50}
            max={95}
            step={5}
            value={[s.threshold]}
            onValueChange={(v) => s.set({ threshold: v[0] })}
          />
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Variation rules (%)</summary>
          <div className="mt-2 space-y-2">
            <RuleRow label="Half" v={s.rules.half} on={(n) => s.set({ rules: { ...s.rules, half: n } })} />
            <RuleRow label="Small" v={s.rules.small} on={(n) => s.set({ rules: { ...s.rules, small: n } })} />
            <RuleRow label="Large" v={s.rules.large} on={(n) => s.set({ rules: { ...s.rules, large: n } })} />
            <RuleRow label="6 pcs" v={s.rules.sixPcs} on={(n) => s.set({ rules: { ...s.rules, sixPcs: n } })} />
            <RuleRow label="+ Ice cream ₹" v={s.rules.withIceCream} on={(n) => s.set({ rules: { ...s.rules, withIceCream: n } })} />
          </div>
        </details>
      </div>

      <Separator />

      <Card className="p-3 text-xs space-y-1">
        <div className="font-medium mb-1">Quick stats</div>
        <Stat label="Source items" value={s.sourceItems.length} />
        <Stat label="CSV rows" value={s.csvRows.length} />
        <Stat
          label="Updated"
          value={s.compare.filter((r) => r.status === "updated" || r.status === "multi-match").length}
        />
      </Card>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={s.reset}>
          <RotateCcw className="h-4 w-4 mr-2" /> New session
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link to="/help">
            <HelpCircle className="h-4 w-4 mr-2" /> Help & Format guide
          </Link>
        </Button>
      </div>
    </aside>
  );
}

function RuleRow({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={v}
        onChange={(e) => on(Number(e.target.value) || 0)}
        className="h-7 w-20 text-right"
      />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
