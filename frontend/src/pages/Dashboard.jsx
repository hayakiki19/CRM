import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, money } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Users, TrendingUp, Trophy, Briefcase, DollarSign, AlertCircle, Globe, CheckSquare,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import StatusBadge from "@/components/StatusBadge";

const COLORS = ["#2563EB", "#60A5FA", "#818CF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#94A3B8"];

function Kpi({ icon: Icon, label, value, tint, onClick }) {
  return (
    <Card onClick={onClick} className={`p-5 border-slate-200 shadow-sm hover:shadow-md transition-shadow ${onClick ? "cursor-pointer hover:border-primary/40" : ""}`} data-testid={`dashboard-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${tint}`}><Icon className="h-5 w-5" /></div>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-4 tabular-nums font-display">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </Card>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { apiGet("/dashboard/stats").then(setS).catch(() => {}); }, []);
  if (!s) return <div className="p-16 text-center text-slate-400">Loading dashboard…</div>;

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Your revenue engine at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Total Leads" value={s.leads} tint="bg-blue-50 text-blue-600" onClick={() => navigate("/leads")} />
        <Kpi icon={TrendingUp} label="Conversion Rate" value={`${s.conversion_rate}%`} tint="bg-indigo-50 text-indigo-600" onClick={() => navigate("/pipeline")} />
        <Kpi icon={DollarSign} label="Pipeline Value" value={money(s.pipeline_value)} tint="bg-violet-50 text-violet-600" onClick={() => navigate("/pipeline")} />
        <Kpi icon={Trophy} label="Won Deals" value={s.won_deals} tint="bg-emerald-50 text-emerald-600" onClick={() => navigate("/deals")} />
        <Kpi icon={DollarSign} label="Revenue" value={money(s.revenue)} tint="bg-emerald-50 text-emerald-600" onClick={() => navigate("/invoices")} />
        <Kpi icon={AlertCircle} label="Outstanding" value={money(s.outstanding)} tint="bg-amber-50 text-amber-600" onClick={() => navigate("/invoices")} />
        <Kpi icon={Briefcase} label="Active Clients" value={s.active_clients} tint="bg-sky-50 text-sky-600" onClick={() => navigate("/clients")} />
        <Kpi icon={Globe} label="Website Leads" value={s.website_leads} tint="bg-rose-50 text-rose-600" onClick={() => navigate("/website-leads")} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={s.revenue_trend}>
              <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Leads by Source</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={s.lead_by_source} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {s.lead_by_source.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {s.lead_by_source.map((e, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{e.name}</span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Pipeline by Stage</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.stage_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Upcoming Tasks</h3>
          <div className="space-y-2">
            {s.upcoming_tasks.length === 0 && <p className="text-sm text-slate-400">No open tasks 🎉</p>}
            {s.upcoming_tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                <CheckSquare className="h-4 w-4 text-slate-300 shrink-0" />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-700 truncate">{t.title}</p><p className="text-xs text-slate-400">{t.due_date || "No due date"}</p></div>
                <StatusBadge value={t.priority} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
