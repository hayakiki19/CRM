import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete, API, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormInput, Plus, Copy, Trash2, X, GripVertical, Code2 } from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES = ["text", "email", "tel", "select", "textarea", "number"];

export default function Forms() {
  const [forms, setForms] = useState([]);
  const [open, setOpen] = useState(false);
  const [embed, setEmbed] = useState(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState([{ name: "name", label: "Full Name", type: "text", required: true }, { name: "email", label: "Email", type: "email", required: true }]);

  const load = () => apiGet("/forms").then(setForms).catch(() => {});
  useEffect(() => { load(); }, []);

  const addField = () => setFields([...fields, { name: `field_${fields.length}`, label: "New Field", type: "text" }]);
  const updField = (i, k, v) => setFields(fields.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  const rmField = (i) => setFields(fields.filter((_, idx) => idx !== i));

  const create = async () => {
    try {
      await apiPost("/forms", { name, fields, submissions: 0, submit_text: "Submit" });
      toast.success("Form created"); setOpen(false); setName(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const remove = async (id) => { await apiDelete(`/forms/${id}`); load(); };

  const embedCode = (f) => `<form data-crm-form>\n${f.fields.map((fl) => `  <input name="${fl.name}" placeholder="${fl.label}" ${fl.required ? "required" : ""}/>`).join("\n")}\n  <button type="submit">${f.submit_text || "Submit"}</button>\n</form>`;
  const apiUrl = (f) => `${API}/public/forms/${f.id}/submit`;
  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Forms</h1>
          <p className="text-slate-500 text-sm mt-1">Build forms that create leads on submission.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="create-form-button"><Plus className="h-4 w-4 mr-1.5" />New Form</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((f) => (
          <Card key={f.id} className="p-5 border-slate-200 shadow-sm" data-testid={`form-card-${f.id}`}>
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center"><FormInput className="h-5 w-5" /></div>
              <span className="text-xs text-slate-400">{f.submissions || 0} submissions</span>
            </div>
            <h3 className="font-semibold text-slate-800 mt-3">{f.name}</h3>
            <p className="text-sm text-slate-400">{(f.fields || []).length} fields</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEmbed(f)} data-testid={`embed-${f.id}`}><Code2 className="h-3.5 w-3.5 mr-1.5" />Embed & API</Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
            </div>
          </Card>
        ))}
        {forms.length === 0 && <Card className="p-16 text-center border-slate-200 col-span-full"><FormInput className="h-10 w-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No forms yet.</p></Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Form Builder</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Form name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="form-name-input" placeholder="Contact form" /></div>
            <div className="space-y-2">
              <Label>Fields</Label>
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                  <GripVertical className="h-4 w-4 text-slate-300" />
                  <Input value={f.label} onChange={(e) => updField(i, "label", e.target.value)} className="h-8 flex-1" placeholder="Label" />
                  <Select value={f.type} onValueChange={(v) => updField(i, "type", v)}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rmField(i)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addField} data-testid="add-field-button"><Plus className="h-3.5 w-3.5 mr-1" />Add Field</Button>
            </div>
          </div>
          <DialogFooter><Button onClick={create} data-testid="save-form-button">Create Form</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!embed} onOpenChange={(v) => !v && setEmbed(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Embed & API</DialogTitle></DialogHeader>
          {embed && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">HTML Embed</p>
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto font-mono">{embedCode(embed)}</pre>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(embedCode(embed))}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy HTML</Button>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-slate-700 mb-1">API Endpoint (POST JSON)</p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-xs truncate">{apiUrl(embed)}</code>
                  <Button size="icon" variant="outline" onClick={() => copy(apiUrl(embed))}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
