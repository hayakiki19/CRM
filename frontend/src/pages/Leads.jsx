import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete, money, formatApiError, http } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Pencil, Trash2, Inbox, Upload, Download, ArrowRight, Phone, Mail, Building2,
  MapPin, Globe, CheckCircle2, Circle, CalendarClock, MessageSquarePlus, UserCheck,
} from "lucide-react";
import { toast } from "sonner";

const slug = (s) => String(s).toLowerCase().replace(/\s+/g, "-");
const daysAgo = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : `${d}d ago`;
};

export default function Leads() {
  const { org } = useAuth();
  const stages = org?.pipeline_stages || [];
  const sources = org?.lead_sources || [];
  const services = org?.services || [];

  const [leads, setLeads] = useState(null);
  const [team, setTeam] = useState([]);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fSource, setFSource] = useState("all");
  const [fAssigned, setFAssigned] = useState("all");
  const [fContacted, setFContacted] = useState("all");
  const [sort, setSort] = useState("newest");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const teamMap = useMemo(() => Object.fromEntries(team.map((m) => [m.user_id, m.name])), [team]);

  const load = async () => {
    try { setLeads(await apiGet("/leads")); } catch { setLeads([]); }
  };
  useEffect(() => { load(); apiGet("/team").then(setTeam).catch(() => {}); }, []);

  const openCreate = () => { setEditing(null); setForm({ status: "New", score: 40, contacted: false }); setDialogOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ ...l }); setDialogOpen(true); };

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      searchParams.delete("new"); setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line

  const openDetail = async (l) => {
    setDetail(l); setActivities([]);
    try { setActivities(await apiGet("/activities", { entity_id: l.id })); } catch { /* ignore */ }
  };

  const counts = useMemo(() => {
    const c = { all: leads?.length || 0, uncontacted: 0 };
    stages.forEach((s) => (c[s] = 0));
    (leads || []).forEach((l) => {
      c[l.status] = (c[l.status] || 0) + 1;
      if (!l.contacted) c.uncontacted += 1;
    });
    return c;
  }, [leads, stages]);

  const filtered = useMemo(() => {
    let list = [...(leads || [])];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((l) => [l.name, l.email, l.company, l.phone, l.service].some((v) => String(v || "").toLowerCase().includes(s)));
    }
    if (fStatus !== "all") list = list.filter((l) => l.status === fStatus);
    if (fSource !== "all") list = list.filter((l) => l.source === fSource);
    if (fAssigned !== "all") list = fAssigned === "unassigned" ? list.filter((l) => !l.assigned_user_id) : list.filter((l) => l.assigned_user_id === fAssigned);
    if (fContacted === "yes") list = list.filter((l) => l.contacted);
    if (fContacted === "no") list = list.filter((l) => !l.contacted);
    if (sort === "score") list.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sort === "budget") list.sort((a, b) => (parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0));
    else list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return list;
  }, [leads, q, fStatus, fSource, fAssigned, fContacted, sort]);

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await apiPut(`/leads/${editing.id}`, form);
      else await apiPost("/leads", form);
      toast.success(editing ? "Lead updated" : "Lead created");
      setDialogOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const patch = async (l, changes, msg) => {
    const updated = { ...l, ...changes };
    setLeads((ls) => ls.map((x) => (x.id === l.id ? updated : x)));
    if (detail?.id === l.id) setDetail(updated);
    try { await apiPut(`/leads/${l.id}`, changes); if (msg) toast.success(msg); }
    catch { load(); }
  };

  const remove = async (l) => {
    if (!window.confirm("Delete this lead?")) return;
    await apiDelete(`/leads/${l.id}`); toast.success("Deleted"); setDetail(null); load();
  };

  const convert = async (l) => {
    try { await apiPost(`/leads/${l.id}/convert`, {}); toast.success("Converted to a deal — see Pipeline"); setDetail(null); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const assign = async (l, userId) => patch(l, { assigned_user_id: userId, assigned_name: teamMap[userId] }, `Assigned to ${teamMap[userId]}`);

  const addNote = async () => {
    if (!note.trim() || !detail) return;
    try {
      await apiPost("/activities", { entity_type: "lead", entity_id: detail.id, description: note });
      setNote("");
      setActivities(await apiGet("/activities", { entity_id: detail.id }));
      toast.success("Note added");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const onExport = async () => {
    try {
      const res = await http.get("/leads/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = "leads_export.xlsx"; a.click(); URL.revokeObjectURL(url);
      toast.success("Exported to Excel");
    } catch { toast.error("Export failed"); }
  };
  const onImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await http.post("/leads/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${data.created} leads${data.skipped_duplicates ? `, skipped ${data.skipped_duplicates} duplicates` : ""}`);
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || "Import failed"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const CHIPS = [["all", "All"], ["uncontacted", "Not Contacted"], ...stages.map((s) => [s, s])];

  return (
    <div className="max-w-[1500px] mx-auto animate-fade-up" data-testid="leads-page">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 text-sm mt-1">Track, qualify and progress every prospect.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} data-testid="import-file-input" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} data-testid="import-leads-button"><Upload className="h-4 w-4 mr-1.5" />{importing ? "Importing…" : "Import"}</Button>
          <Button variant="outline" onClick={onExport} data-testid="export-leads-button"><Download className="h-4 w-4 mr-1.5" />Export</Button>
          <Button onClick={openCreate} data-testid="create-leads-button"><Plus className="h-4 w-4 mr-1.5" />New Lead</Button>
        </div>
      </div>

      {/* status chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CHIPS.map(([val, label]) => {
          const active = fStatus === val || (val === "uncontacted" && fContacted === "no");
          return (
            <button key={val} data-testid={`status-chip-${slug(label)}`}
              onClick={() => { if (val === "uncontacted") { setFContacted(fContacted === "no" ? "all" : "no"); setFStatus("all"); } else { setFStatus(val === "all" ? "all" : val); setFContacted("all"); } }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              {label}<span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-slate-400"}`}>{val === "uncontacted" ? counts.uncontacted : counts[val] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* filter bar */}
      <Card className="p-3 border-slate-200 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search name, email, company…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9 bg-slate-50" data-testid="lead-search" />
          </div>
          <Select value={fSource} onValueChange={setFSource}><SelectTrigger className="w-40 h-9" data-testid="filter-source"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All sources</SelectItem>{sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          <Select value={fAssigned} onValueChange={setFAssigned}><SelectTrigger className="w-40 h-9" data-testid="filter-assigned"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Anyone</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent></Select>
          <Select value={fContacted} onValueChange={setFContacted}><SelectTrigger className="w-40 h-9" data-testid="filter-contacted"><SelectValue placeholder="Contacted" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="yes">Contacted</SelectItem><SelectItem value="no">Not contacted</SelectItem></SelectContent></Select>
          <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-36 h-9" data-testid="sort-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="score">Top score</SelectItem><SelectItem value="budget">Top budget</SelectItem></SelectContent></Select>
        </div>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="px-4 py-2.5 border-b border-slate-100 text-sm text-slate-400">{filtered.length} leads</div>
        {leads === null ? <div className="p-16 text-center text-slate-400">Loading…</div> :
          filtered.length === 0 ? <div className="p-16 text-center"><Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No leads match these filters.</p></div> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                {["Lead", "Company", "Source", "Status", "Score", "Budget", "Owner", "Contacted", "Follow-up", ""].map((h, i) =>
                  <TableHead key={i} className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id} className="hover:bg-slate-50/70 cursor-pointer" data-testid={`row-lead-${l.id}`} onClick={() => openDetail(l)}>
                    <TableCell><div className="font-medium text-slate-800">{l.name}</div><div className="text-xs text-slate-400">{l.email || l.phone || "—"}</div></TableCell>
                    <TableCell className="text-slate-600">{l.company || "—"}</TableCell>
                    <TableCell><StatusBadge value={l.source} /></TableCell>
                    <TableCell><StatusBadge value={l.status} /></TableCell>
                    <TableCell><div className="flex items-center gap-2"><div className="h-1.5 w-14 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, l.score || 0)}%` }} /></div><span className="text-xs text-slate-500">{l.score || 0}</span></div></TableCell>
                    <TableCell className="tabular-nums text-slate-600">{l.budget ? money(l.budget) : "—"}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{teamMap[l.assigned_user_id] || <span className="text-slate-300">Unassigned</span>}</TableCell>
                    <TableCell>{l.contacted ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle2 className="h-4 w-4" />Yes</span> : <span className="flex items-center gap-1 text-slate-400 text-xs"><Circle className="h-3.5 w-3.5" />No</span>}</TableCell>
                    <TableCell className="text-xs text-slate-500">{l.follow_up_date || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {!l.converted && <Button size="sm" variant="ghost" className="h-8 text-primary hover:bg-blue-50 font-medium" onClick={() => convert(l)} data-testid={`convert-${l.id}`}>→ Deal</Button>}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(l)} data-testid={`edit-${l.id}`}><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(l)} data-testid={`delete-${l.id}`}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Lead" : "New Lead"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[["name", "Full name", "text", true], ["email", "Email", "email"], ["phone", "Phone", "text"], ["company", "Company", "text"], ["website", "Website", "text"], ["location", "Location", "text"], ["budget", "Budget", "text"], ["score", "Lead score", "number"]].map(([n, lbl, t, req]) => (
              <div key={n} className="col-span-2 sm:col-span-1"><Label className="text-xs">{lbl}{req && <span className="text-rose-500"> *</span>}</Label>
                <Input type={t === "number" ? "number" : t === "email" ? "email" : "text"} value={form[n] || ""} onChange={(e) => setForm({ ...form, [n]: e.target.value })} className="mt-1" data-testid={`field-${n}`} /></div>
            ))}
            {[["source", "Lead source", sources], ["service", "Service interest", services], ["status", "Status", stages]].map(([n, lbl, opts]) => (
              <div key={n} className="col-span-2 sm:col-span-1"><Label className="text-xs">{lbl}</Label>
                <Select value={form[n] || ""} onValueChange={(v) => setForm({ ...form, [n]: v })}><SelectTrigger className="mt-1" data-testid={`field-${n}`}><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
            ))}
            <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Assign to</Label>
              <Select value={form.assigned_user_id || ""} onValueChange={(v) => setForm({ ...form, assigned_user_id: v, assigned_name: teamMap[v] })}><SelectTrigger className="mt-1" data-testid="field-assigned_user_id"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name} · {String(m.role).replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Follow-up date</Label>
              <Input type="date" value={form.follow_up_date || ""} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} className="mt-1" data-testid="field-follow_up_date" /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={!!form.contacted} onCheckedChange={(v) => setForm({ ...form, contacted: !!v })} data-testid="field-contacted" />Already contacted</label>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" data-testid="field-notes" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} data-testid="save-lead-button">{saving ? "Saving…" : "Save Lead"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail slide-over */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0" data-testid="lead-detail-sheet">
          {detail && (
            <div>
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div><h2 className="font-display text-xl font-bold text-slate-900">{detail.name}</h2><p className="text-sm text-slate-400 mt-0.5">Added {daysAgo(detail.created_at)}</p></div>
                  <StatusBadge value={detail.status} />
                </div>
                <div className="flex gap-2 mt-4">
                  {detail.contacted
                    ? <Button size="sm" variant="outline" onClick={() => patch(detail, { contacted: false }, "Marked not contacted")} data-testid="mark-not-contacted-button"><Circle className="h-4 w-4 mr-1.5" />Mark Not Contacted</Button>
                    : <Button size="sm" onClick={() => patch(detail, { contacted: true, status: detail.status === "New" ? "Contacted" : detail.status, last_contacted_at: new Date().toISOString() }, "Marked contacted")} data-testid="mark-contacted-button"><CheckCircle2 className="h-4 w-4 mr-1.5" />Mark Contacted</Button>}
                  {!detail.converted && <Button size="sm" variant="outline" onClick={() => convert(detail)} data-testid="convert-lead-button"><ArrowRight className="h-4 w-4 mr-1.5" />Convert to Deal</Button>}
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {[[Mail, detail.email], [Phone, detail.phone], [Building2, detail.company], [Globe, detail.website], [MapPin, detail.location]].filter(([, v]) => v).map(([Icon, v], i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-600"><Icon className="h-4 w-4 text-slate-400" />{v}</div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Score</p><p className="font-semibold text-slate-800">{detail.score || 0}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Budget</p><p className="font-semibold text-slate-800">{detail.budget ? money(detail.budget) : "—"}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Source</p><p className="font-semibold text-slate-800">{detail.source || "—"}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Service</p><p className="font-semibold text-slate-800">{detail.service || "—"}</p></div>
                </div>

                {/* quick stage change */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Move stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map((s) => (
                      <button key={s} data-testid={`quick-stage-${slug(s)}`} onClick={() => patch(detail, { status: s }, `Moved to ${s}`)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${detail.status === s ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary"}`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* assign + follow-up */}
                <div className="grid grid-cols-1 gap-3">
                  <div><Label className="text-xs flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" />Owner</Label>
                    <Select value={detail.assigned_user_id || ""} onValueChange={(v) => assign(detail, v)}><SelectTrigger className="mt-1" data-testid="assign-select"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label className="text-xs flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Follow-up date</Label>
                    <Input type="date" value={detail.follow_up_date || ""} onChange={(e) => patch(detail, { follow_up_date: e.target.value })} className="mt-1" data-testid="followup-input" /></div>
                </div>

                {/* activity timeline */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Activity & Notes</p>
                  <div className="flex gap-2 mb-3">
                    <Input placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} data-testid="add-note-input" />
                    <Button size="icon" onClick={addNote} data-testid="add-note-button"><MessageSquarePlus className="h-4 w-4" /></Button>
                  </div>
                  <div className="space-y-3">
                    {activities.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
                    {activities.map((a) => (
                      <div key={a.id} className="flex gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div><p className="text-sm text-slate-700">{a.description}</p><p className="text-xs text-slate-400">{daysAgo(a.created_at)}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
