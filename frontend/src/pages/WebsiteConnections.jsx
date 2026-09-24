import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete, API, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Globe, Plus, Copy, Trash2, Code2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

const PLATFORMS = ["custom", "WordPress", "Shopify", "Webflow"];

export default function WebsiteConnections() {
  const [sites, setSites] = useState([]);
  const [open, setOpen] = useState(false);
  const [snippet, setSnippet] = useState(null);
  const [form, setForm] = useState({ name: "", domain: "", platform: "custom" });

  const load = () => apiGet("/websites").then(setSites).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await apiPost("/websites", { ...form, status: "connected" });
      toast.success("Website connected"); setOpen(false); setForm({ name: "", domain: "", platform: "custom" }); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const remove = async (id) => { await apiDelete(`/websites/${id}`); load(); };

  const scriptFor = (site) => `<script\n  src="${API}/public/lead-capture.js?site_id=${site.id}"\n  data-site-id="${site.id}">\n</script>`;
  const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); };

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Website Connections</h1>
          <p className="text-slate-500 text-sm mt-1">Connect a site and capture enquiries automatically.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="connect-website-button"><Plus className="h-4 w-4 mr-1.5" />Connect Website</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map((s) => (
          <Card key={s.id} className="p-5 border-slate-200 shadow-sm" data-testid={`site-card-${s.id}`}>
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><Globe className="h-5 w-5" /></div>
              <StatusBadge value={s.status} />
            </div>
            <h3 className="font-semibold text-slate-800 mt-3">{s.name}</h3>
            <p className="text-sm text-slate-400">{s.domain || "—"} · {s.platform}</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setSnippet(s)} data-testid={`view-script-${s.id}`}><Code2 className="h-3.5 w-3.5 mr-1.5" />Tracking Script</Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
            </div>
          </Card>
        ))}
        {sites.length === 0 && <Card className="p-16 text-center border-slate-200 col-span-full"><Globe className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No websites connected yet.</p></Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connect a Website</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Website name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="site-name-input" placeholder="Marketing site" /></div>
            <div><Label>Domain</Label><Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="example.com" /></div>
            <div><Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={create} data-testid="save-site-button">Connect</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!snippet} onOpenChange={(v) => !v && setSnippet(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tracking Script</DialogTitle></DialogHeader>
          {snippet && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Paste this before <code>&lt;/body&gt;</code>. Add <code>data-crm-form</code> to any form to capture it.</p>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto font-mono">{scriptFor(snippet)}</pre>
              <Button className="w-full" onClick={() => copy(scriptFor(snippet))} data-testid="copy-script-button"><Copy className="h-4 w-4 mr-1.5" />Copy Script</Button>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-slate-700 mb-1">REST API / Webhook endpoint</p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-xs truncate">{API}/public/capture</code>
                  <Button size="icon" variant="outline" onClick={() => copy(`${API}/public/capture`)}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-slate-400 mt-2">POST JSON with <code>site_id={snippet.id}</code> plus name, email, phone, message…</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
