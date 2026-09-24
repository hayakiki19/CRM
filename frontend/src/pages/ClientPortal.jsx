import { useEffect, useState } from "react";
import { apiGet, money } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import StatusBadge from "@/components/StatusBadge";
import { LayoutGrid, LogOut, FolderKanban, ReceiptText, CheckSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ClientPortal() {
  const { user, org, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    apiGet("/projects").then(setProjects).catch(() => {});
    apiGet("/invoices").then(setInvoices).catch(() => {});
    apiGet("/tasks").then(setTasks).catch(() => {});
  }, []);

  const outstanding = invoices.reduce((a, i) => a + Number(i.pending_amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {org?.logo_url ? <img src={org.logo_url} alt="" className="h-8 w-8 rounded-lg" /> : <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center text-white"><LayoutGrid className="h-5 w-5" /></div>}
          <span className="font-display font-bold text-slate-800">{org?.name} · Client Portal</span>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { logout(); navigate("/login"); }} data-testid="portal-logout"><LogOut className="h-4 w-4 mr-1.5" />Log out</Button>
      </header>

      <main className="max-w-5xl mx-auto p-6 animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-slate-900">Welcome, {user?.name}</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">Your projects, invoices and updates in one place.</p>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-5 border-slate-200"><FolderKanban className="h-5 w-5 text-blue-600" /><p className="text-2xl font-bold mt-3 font-display">{projects.length}</p><p className="text-sm text-slate-500">Projects</p></Card>
          <Card className="p-5 border-slate-200"><ReceiptText className="h-5 w-5 text-amber-600" /><p className="text-2xl font-bold mt-3 font-display">{money(outstanding)}</p><p className="text-sm text-slate-500">Outstanding</p></Card>
          <Card className="p-5 border-slate-200"><CheckSquare className="h-5 w-5 text-emerald-600" /><p className="text-2xl font-bold mt-3 font-display">{tasks.length}</p><p className="text-sm text-slate-500">Tasks</p></Card>
        </div>

        <Tabs defaultValue="projects">
          <TabsList className="mb-4"><TabsTrigger value="projects">Projects</TabsTrigger><TabsTrigger value="invoices">Invoices</TabsTrigger><TabsTrigger value="tasks">Tasks</TabsTrigger></TabsList>

          <TabsContent value="projects" className="space-y-3">
            {projects.map((p) => (
              <Card key={p.id} className="p-5 border-slate-200">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-800">{p.name}</h3><StatusBadge value={p.status} /></div>
                <div className="mt-3"><div className="flex justify-between text-xs text-slate-500 mb-1"><span>Progress</span><span>{p.progress || 0}%</span></div><Progress value={p.progress || 0} className="h-2" /></div>
              </Card>
            ))}
            {projects.length === 0 && <p className="text-sm text-slate-400">No projects assigned.</p>}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-3">
            {invoices.map((i) => (
              <Card key={i.id} className="p-5 border-slate-200 flex items-center justify-between">
                <div><p className="font-semibold text-slate-800">{i.number}</p><p className="text-xs text-slate-400">Due {i.due_date}</p></div>
                <div className="text-right"><p className="font-bold text-slate-900">{money(i.total)}</p><StatusBadge value={i.status} /></div>
              </Card>
            ))}
            {invoices.length === 0 && <p className="text-sm text-slate-400">No invoices.</p>}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-2">
            {tasks.map((t) => (
              <Card key={t.id} className="p-4 border-slate-200 flex items-center gap-3"><CheckSquare className="h-4 w-4 text-slate-300" /><span className="flex-1 text-sm text-slate-700">{t.title}</span><StatusBadge value={t.status} /></Card>
            ))}
            {tasks.length === 0 && <p className="text-sm text-slate-400">No tasks.</p>}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
