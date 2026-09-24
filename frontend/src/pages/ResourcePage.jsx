import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete, money, formatApiError, http } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Inbox, Upload, Download } from "lucide-react";
import { toast } from "sonner";

function resolveOptions(opt, org) {
  if (Array.isArray(opt)) return opt;
  if (opt === "$stages") return org?.pipeline_stages || [];
  if (opt === "$sources") return org?.lead_sources || [];
  if (opt === "$services") return org?.services || [];
  return [];
}

export default function ResourcePage({ cfg }) {
  const { org } = useAuth();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await apiGet(`/${cfg.resource}`, cfg.fixedFilter);
      setItems(data);
    } catch { setItems([]); }
  };
  // reload when the config (route) changes
  useEffect(() => { setItems(null); load(); /* eslint-disable-next-line */ }, [cfg.resource, cfg.title]);

  const [team, setTeam] = useState([]);
  useEffect(() => {
    const needsTeam = cfg.fields.some((f) => f.type === "user") || cfg.columns.some((c) => c.type === "user");
    if (needsTeam) apiGet("/team").then(setTeam).catch(() => {});
  }, [cfg.resource]); // eslint-disable-line
  const teamMap = useMemo(() => Object.fromEntries(team.map((m) => [m.user_id, m.name])), [team]);

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const onExport = async () => {
    try {
      const res = await http.get(`/${cfg.resource}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `${cfg.resource}_export.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported to Excel");
    } catch { toast.error("Export failed"); }
  };
  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await http.post(`/${cfg.resource}/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${data.created} leads${data.skipped_duplicates ? `, skipped ${data.skipped_duplicates} duplicates` : ""}`);
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || "Import failed"); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((it) => Object.values(it).some((v) => String(v ?? "").toLowerCase().includes(s)));
  }, [items, q]);

  const openCreate = () => { setEditing(null); setForm({ ...(cfg.defaults || {}) }); setDialogOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...it }); setDialogOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...(cfg.defaults || {}), ...form, ...(cfg.fixedFilter || {}) };
      if (editing) await apiPut(`/${cfg.resource}/${editing.id}`, payload);
      else await apiPost(`/${cfg.resource}`, payload);
      toast.success(editing ? "Updated" : "Created");
      setDialogOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const remove = async (it) => {
    if (!window.confirm("Delete this record?")) return;
    await apiDelete(`/${cfg.resource}/${it.id}`);
    toast.success("Deleted");
    load();
  };

  const renderCell = (col, it) => {
    const v = it[col.key];
    if (col.type === "badge") return <StatusBadge value={v} />;
    if (col.type === "money") return <span className="tabular-nums">{money(v)}</span>;
    if (col.type === "score") return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, v || 0)}%` }} /></div>
        <span className="text-xs text-slate-500">{v || 0}</span>
      </div>
    );
    if (col.type === "user") return <span className="text-slate-600">{teamMap[v] || "—"}</span>;
    if (col.primary) return <span className="font-medium text-slate-800">{v || "—"}</span>;
    return <span className="text-slate-600">{v || "—"}</span>;
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">{cfg.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{cfg.subtitle}</p>
        </div>
        {!cfg.hideCreate && (
          <div className="flex items-center gap-2">
            {cfg.importExport && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} data-testid="import-file-input" />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} data-testid="import-leads-button"><Upload className="h-4 w-4 mr-1.5" />{importing ? "Importing…" : "Import"}</Button>
                <Button variant="outline" onClick={onExport} data-testid="export-leads-button"><Download className="h-4 w-4 mr-1.5" />Export</Button>
              </>
            )}
            <Button onClick={openCreate} data-testid={`create-${cfg.resource}-button`}><Plus className="h-4 w-4 mr-1.5" />New {cfg.title.replace(/s$/, "")}</Button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9 bg-slate-50" data-testid={`search-${cfg.resource}`} />
          </div>
          <span className="ml-auto text-sm text-slate-400">{filtered.length} records</span>
        </div>

        {items === null ? (
          <div className="p-16 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No records yet</p>
            {!cfg.hideCreate && <p className="text-sm text-slate-400 mt-1">Create your first {cfg.title.toLowerCase().replace(/s$/, "")} to get started.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                  {cfg.columns.map((c) => <TableHead key={c.key} className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{c.label}</TableHead>)}
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it) => (
                  <TableRow key={it.id} className="hover:bg-slate-50/70 cursor-pointer" data-testid={`row-${cfg.resource}-${it.id}`} onClick={() => openEdit(it)}>
                    {cfg.columns.map((c) => <TableCell key={c.key}>{renderCell(c, it)}</TableCell>)}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(it)} data-testid={`edit-${it.id}`}><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(it)} data-testid={`delete-${it.id}`}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Edit ${cfg.title.replace(/s$/, "")}` : `New ${cfg.title.replace(/s$/, "")}`}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {cfg.fields.map((f) => (
              <div key={f.name} className={f.full || f.type === "textarea" ? "col-span-2" : "col-span-2 sm:col-span-1"}>
                <Label className="text-xs">{f.label}{f.required && <span className="text-rose-500"> *</span>}</Label>
                {f.type === "textarea" ? (
                  <Textarea value={form[f.name] || ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} className="mt-1" data-testid={`field-${f.name}`} />
                ) : f.type === "user" ? (
                  <Select value={form[f.name] || ""} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                    <SelectTrigger className="mt-1" data-testid={`field-${f.name}`}><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name} · {String(m.role).replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                ) : f.type === "select" ? (
                  <Select value={form[f.name] || ""} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                    <SelectTrigger className="mt-1" data-testid={`field-${f.name}`}><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{resolveOptions(f.options, org).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                    value={form[f.name] || ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} className="mt-1" data-testid={`field-${f.name}`} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid="save-record-button">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
