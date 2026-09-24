import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, FolderKanban, CalendarDays } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ name: "", deadline: "", status: "active" });

  const load = () => apiGet("/projects").then(setProjects).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await apiPost("/projects", { ...form, progress: 0, milestones: [] });
      toast.success("Project created"); setOpen(false); setForm({ name: "", deadline: "", status: "active" }); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const toggleMilestone = async (idx) => {
    const ms = [...(detail.milestones || [])];
    ms[idx] = { ...ms[idx], done: !ms[idx].done };
    const progress = ms.length ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100) : detail.progress;
    const updated = { ...detail, milestones: ms, progress };
    setDetail(updated);
    setProjects((ps) => ps.map((p) => (p.id === detail.id ? updated : p)));
    await apiPut(`/projects/${detail.id}`, { milestones: ms, progress });
  };

  const addMilestone = async () => {
    const title = window.prompt("Milestone title");
    if (!title) return;
    const ms = [...(detail.milestones || []), { title, done: false }];
    const updated = { ...detail, milestones: ms };
    setDetail(updated);
    await apiPut(`/projects/${detail.id}`, { milestones: ms });
    load();
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-1">Deliver work with milestones and progress.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="create-project-button"><Plus className="h-4 w-4 mr-1.5" />New Project</Button>
      </div>

      {projects.length === 0 ? (
        <Card className="p-16 text-center border-slate-200"><FolderKanban className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No projects yet.</p></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="p-5 border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetail(p)} data-testid={`project-card-${p.id}`}>
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-800">{p.name}</h3>
                <StatusBadge value={p.status} />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Progress</span><span>{p.progress || 0}%</span></div>
                <Progress value={p.progress || 0} className="h-2" />
              </div>
              <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
                {p.deadline && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{p.deadline}</span>}
                <span>{(p.milestones || []).length} milestones</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Project name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="project-name-input" /></div>
            <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={create} data-testid="save-project-button">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detail && (
            <>
              <SheetHeader><SheetTitle>{detail.name}</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <div className="flex justify-between text-sm text-slate-500 mb-1"><span>Progress</span><span>{detail.progress || 0}%</span></div>
                  <Progress value={detail.progress || 0} className="h-2.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-slate-700 text-sm">Milestones</h4>
                    <Button size="sm" variant="outline" onClick={addMilestone} data-testid="add-milestone-button"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button></div>
                  <div className="space-y-2">
                    {(detail.milestones || []).map((m, i) => (
                      <label key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                        <Checkbox checked={m.done} onCheckedChange={() => toggleMilestone(i)} data-testid={`milestone-${i}`} />
                        <span className={`text-sm ${m.done ? "line-through text-slate-400" : "text-slate-700"}`}>{m.title}</span>
                      </label>
                    ))}
                    {(detail.milestones || []).length === 0 && <p className="text-sm text-slate-400">No milestones yet.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
