import { useEffect, useState } from "react";
import { apiGet, apiPut, apiPost, money, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";

const STAGE_TINT = {
  Won: "border-t-emerald-400", Lost: "border-t-rose-400", New: "border-t-blue-400",
};

export default function Pipeline() {
  const { org } = useAuth();
  const stages = org?.pipeline_stages || [];
  const [deals, setDeals] = useState([]);
  const [drag, setDrag] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", company: "", stage: stages[0] });

  const load = () => apiGet("/deals").then(setDeals).catch(() => {});
  useEffect(() => { load(); }, []);

  const move = async (deal, stage) => {
    if (deal.stage === stage) return;
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? { ...d, stage } : d)));
    try {
      await apiPut(`/deals/${deal.id}`, { stage });
      if (stage === "Won") toast.success("Deal won! Client & project auto-created.");
    } catch { load(); }
  };

  const create = async () => {
    try {
      await apiPost("/deals", { ...form, value: Number(form.value) || 0 });
      toast.success("Deal created");
      setOpen(false); setForm({ title: "", value: "", company: "", stage: stages[0] });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="max-w-full animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-500 text-sm mt-1">Drag deals across stages. Drop into <b>Won</b> to auto-convert.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="create-deal-button"><Plus className="h-4 w-4 mr-1.5" />New Deal</Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll" data-testid="pipeline-board">
        {stages.map((stage) => {
          const col = deals.filter((d) => d.stage === stage);
          const total = col.reduce((a, d) => a + (Number(d.value) || 0), 0);
          return (
            <div key={stage} className="w-72 shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag) move(drag, stage); setDrag(null); }}
              data-testid={`pipeline-column-${stage.toLowerCase()}`}>
              <div className={`bg-white rounded-xl border border-slate-200 border-t-4 ${STAGE_TINT[stage] || "border-t-slate-300"} shadow-sm`}>
                <div className="p-3 flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-700">{stage}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{col.length}</span>
                </div>
                <div className="px-3 pb-1 text-xs text-slate-400">{money(total)}</div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {col.map((d) => (
                    <div key={d.id} draggable onDragStart={() => setDrag(d)} onDragEnd={() => setDrag(null)}
                      className="bg-white border border-slate-200 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all group"
                      data-testid={`deal-card-${d.id}`}>
                      <div className="flex items-start gap-1">
                        <GripVertical className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                          <p className="text-xs text-slate-400 truncate">{d.company || "—"}</p>
                          <p className="text-sm font-semibold text-primary mt-1.5 tabular-nums">{money(d.value)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Deal title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="deal-title-input" /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} data-testid="deal-value-input" /></div>
            <div><Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={create} data-testid="save-deal-button">Create Deal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
