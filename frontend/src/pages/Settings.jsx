import { useEffect, useState } from "react";
import { apiGet, apiPut, apiPost, apiDelete, formatApiError } from "@/lib/api";
import { useAuth, applyBrand } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StatusBadge from "@/components/StatusBadge";
import { X, Plus, Trash2, Palette } from "lucide-react";
import { toast } from "sonner";

function TagEditor({ label, items, onChange, testid }) {
  const [val, setVal] = useState("");
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 mt-2 mb-2">
        {(items || []).map((it, i) => (
          <span key={i} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-sm rounded-full pl-3 pr-1.5 py-1">
            {it}<button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val) { onChange([...(items || []), val]); setVal(""); } }} placeholder={`Add ${label.toLowerCase()}…`} data-testid={testid} />
        <Button variant="outline" onClick={() => { if (val) { onChange([...(items || []), val]); setVal(""); } }}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { org, setOrg, refreshOrg, user } = useAuth();
  const [draft, setDraft] = useState(org || {});
  const [team, setTeam] = useState([]);
  const [autos, setAutos] = useState([]);
  const [memberOpen, setMemberOpen] = useState(false);
  const [member, setMember] = useState({ name: "", email: "", password: "", role: "member" });

  useEffect(() => { setDraft(org || {}); }, [org]);
  useEffect(() => { apiGet("/team").then(setTeam).catch(() => {}); apiGet("/automations").then(setAutos).catch(() => {}); }, []);

  const saveOrg = async () => {
    try {
      const updated = await apiPut("/org", {
        name: draft.name, logo_url: draft.logo_url, primary_color: draft.primary_color,
        pipeline_stages: draft.pipeline_stages, lead_sources: draft.lead_sources, services: draft.services,
      });
      setOrg(updated); applyBrand(updated.primary_color); toast.success("Settings saved");
      refreshOrg();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const addMember = async () => {
    try {
      await apiPost("/team", member);
      toast.success("Team member added"); setMemberOpen(false); setMember({ name: "", email: "", password: "", role: "member" });
      apiGet("/team").then(setTeam);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const rmMember = async (id) => { await apiDelete(`/team/${id}`); apiGet("/team").then(setTeam); };

  const toggleAuto = async (a) => {
    await apiPut(`/automations/${a.id}`, { enabled: !a.enabled });
    apiGet("/automations").then(setAutos);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-slate-500 text-sm mb-6">Customize your workspace, team and automations.</p>

      <Tabs defaultValue="branding">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="branding" data-testid="tab-branding">Branding</TabsTrigger>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline & Fields</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team & Roles</TabsTrigger>
          <TabsTrigger value="automations" data-testid="tab-automations">Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card className="p-6 border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl grid place-items-center text-white text-2xl font-bold shrink-0" style={{ background: draft.primary_color || "#2563EB" }}>
                {draft.logo_url ? <img src={draft.logo_url} alt="" className="h-full w-full object-cover rounded-2xl" /> : (draft.name || "F")[0]}
              </div>
              <div className="flex-1"><Label>Organization name</Label><Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1" data-testid="org-name-input" /></div>
            </div>
            <div><Label>Logo URL</Label><Input value={draft.logo_url || ""} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} className="mt-1" placeholder="https://…/logo.png" data-testid="org-logo-input" /></div>
            <div>
              <Label className="flex items-center gap-1.5"><Palette className="h-4 w-4" />Primary brand color</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={draft.primary_color || "#2563EB"} onChange={(e) => { setDraft({ ...draft, primary_color: e.target.value }); applyBrand(e.target.value); }} className="h-10 w-14 rounded-lg border cursor-pointer" data-testid="org-color-input" />
                <Input value={draft.primary_color || ""} onChange={(e) => { setDraft({ ...draft, primary_color: e.target.value }); applyBrand(e.target.value); }} className="w-32 font-mono" />
              </div>
            </div>
            <Button onClick={saveOrg} data-testid="save-branding-button">Save Branding</Button>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline">
          <Card className="p-6 border-slate-200 shadow-sm space-y-6">
            <TagEditor label="Pipeline Stages" items={draft.pipeline_stages} onChange={(v) => setDraft({ ...draft, pipeline_stages: v })} testid="stages-input" />
            <TagEditor label="Lead Sources" items={draft.lead_sources} onChange={(v) => setDraft({ ...draft, lead_sources: v })} testid="sources-input" />
            <TagEditor label="Services" items={draft.services} onChange={(v) => setDraft({ ...draft, services: v })} testid="services-input" />
            <Button onClick={saveOrg} data-testid="save-pipeline-button">Save Configuration</Button>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card className="p-6 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Team Members</h3>
              <Button size="sm" onClick={() => setMemberOpen(true)} data-testid="add-member-button"><Plus className="h-4 w-4 mr-1.5" />Add Member</Button>
            </div>
            <div className="space-y-2">
              {team.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
                  <div className="h-9 w-9 rounded-lg bg-primary text-white grid place-items-center font-medium">{(m.name || "U")[0]}</div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800 truncate">{m.name}</p><p className="text-xs text-slate-400 truncate">{m.email}</p></div>
                  <StatusBadge value={m.role} />
                  {m.user_id !== user.user_id && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rmMember(m.user_id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="automations">
          <Card className="p-6 border-slate-200 shadow-sm space-y-3">
            <p className="text-sm text-slate-500">WHEN → IF → THEN rules that run automatically.</p>
            {autos.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-4 rounded-lg border border-slate-100">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-400">Trigger: <code>{a.trigger}</code> → {(a.actions || []).map((x) => x.type).join(", ")}</p>
                </div>
                <Switch checked={a.enabled} onCheckedChange={() => toggleAuto(a)} data-testid={`automation-toggle-${a.id}`} />
              </div>
            ))}
            {autos.length === 0 && <p className="text-sm text-slate-400">No automations configured.</p>}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name</Label><Input value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} data-testid="member-name-input" /></div>
            <div><Label>Email</Label><Input type="email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} data-testid="member-email-input" /></div>
            <div><Label>Temporary password</Label><Input value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} placeholder="Welcome@123" /></div>
            <div><Label>Role</Label>
              <Select value={member.role} onValueChange={(v) => setMember({ ...member, role: v })}>
                <SelectTrigger data-testid="member-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Team Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={addMember} data-testid="save-member-button">Add Member</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
