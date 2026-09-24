import { useEffect, useState } from "react";
import { apiGet, apiPost, money, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GripVertical, User, Handshake } from "lucide-react";
import { toast } from "sonner";

const STAGE_TINT = { Won: "border-t-emerald-400", Lost: "border-t-rose-400", New: "border-t-blue-400" };

export default function Pipeline() {
  const { org } = useAuth();
  const stages = org?.pipeline_stages || [];
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", company: "", stage: stages[0] });

  const load = () => apiGet("/pipeline").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const move = async (item, stage) => {
    if (item.stage === stage) return;
    setItems((its) => its.map((i) => (i.id === item.id && i.kind === item.kind ? { ...i, stage } : i)));
    try {
      const r = await apiPost(`/pipeline/${item.kind}/${item.id}/stage`, { stage });
      (r.actions || []).forEach((a) => toast.success(a));
      if (!r.actions?.length) toast.success(`Moved to ${stage}`);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); load(); }
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
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-500 text-sm mt-1">Leads &amp; deals in one flow. Drag to move a stage — it updates the lead/deal and auto-creates proposals, contracts and clients.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="create-deal-button"><Plus className="h-4 w-4 mr-1.5" />New Deal</Button>
      </div>
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200 border border-slate-300" />Lead</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-100 border border-blue-300" />Deal</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll" data-testid="pipeline-board">
        {stages.map((stage) => {
          const col = items.filter((i) => i.stage === stage);
          const total = col.reduce((a, i) => a + (Number(i.value) || 0), 0);
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
                  {col.map((i) => (
                    <div key={`${i.kind}-${i.id}`} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
                      className={`bg-white border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all group ${i.kind === "deal" ? "border-blue-200 hover:border-primary" : "border-slate-200 hover:border-slate-400"}`}
                      data-testid={`${i.kind}-card-${i.id}`}>
                      <div className="flex items-start gap-1">
                        <GripVertical className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${i.kind === "deal" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                              {i.kind === "deal" ? <Handshake className="h-3 w-3" /> : <User className="h-3 w-3" />}{i.kind}
                            </span>
                            {i.kind === "lead" && i.contacted && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Contacted" />}
                          </div>
                          <p className="text-sm font-medium text-slate-800 truncate mt-1">{i.title}</p>
                          <p className="text-xs text-slate-400 truncate">{i.company || i.email || "—"}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-sm font-semibold text-primary tabular-nums">{money(i.value)}</p>
                            {i.assigned_name && <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{i.assigned_name}</span>}
                          </div>
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
