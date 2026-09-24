import { useEffect, useState } from "react";
import { apiGet, money } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileBarChart } from "lucide-react";
import { toast } from "sonner";

function toCSV(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
}

export default function Reports() {
  const [stats, setStats] = useState(null);
  useEffect(() => { apiGet("/dashboard/stats").then(setStats).catch(() => {}); }, []);

  const exportResource = async (resource) => {
    const data = await apiGet(`/${resource}`);
    const csv = toCSV(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${resource}.csv`; a.click();
    toast.success(`Exported ${data.length} ${resource}`);
  };

  const cards = [
    ["Total Leads", stats?.leads], ["Won Deals", stats?.won_deals],
    ["Pipeline Value", money(stats?.pipeline_value || 0)], ["Revenue", money(stats?.revenue || 0)],
    ["Outstanding", money(stats?.outstanding || 0)], ["Conversion", `${stats?.conversion_rate || 0}%`],
  ];

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Key metrics and data exports.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-5 border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-display tabular-nums">{value ?? "—"}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6 border-slate-200 shadow-sm">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4"><FileBarChart className="h-5 w-5 text-primary" />Export data (CSV)</h3>
        <div className="flex flex-wrap gap-2">
          {["leads", "deals", "clients", "invoices", "payments", "projects", "campaigns"].map((r) => (
            <Button key={r} variant="outline" size="sm" onClick={() => exportResource(r)} data-testid={`export-${r}`}>
              <Download className="h-3.5 w-3.5 mr-1.5" />{r}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
