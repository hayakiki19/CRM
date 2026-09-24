import { useEffect, useState } from "react";
import { apiGet, money } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Eye, Users, Target, DollarSign, TrendingUp } from "lucide-react";

const COLORS = ["#2563EB", "#60A5FA", "#818CF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA"];

function Stat({ icon: Icon, label, value, tint }) {
  return (
    <Card className="p-5 border-slate-200 shadow-sm">
      <div className={`h-10 w-10 rounded-xl grid place-items-center ${tint}`}><Icon className="h-5 w-5" /></div>
      <p className="text-2xl font-bold text-slate-900 mt-4 font-display tabular-nums">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </Card>
  );
}

export default function Analytics() {
  const [d, setD] = useState(null);
  useEffect(() => { apiGet("/analytics/overview").then(setD).catch(() => {}); }, []);
  if (!d) return <div className="p-16 text-center text-slate-400">Loading analytics…</div>;

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Website & Marketing Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Traffic, conversions and campaign ROAS.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat icon={Eye} label="Visitors" value={d.visitors.toLocaleString()} tint="bg-blue-50 text-blue-600" />
        <Stat icon={Users} label="Leads" value={d.leads} tint="bg-indigo-50 text-indigo-600" />
        <Stat icon={Target} label="Conversions" value={d.conversions} tint="bg-violet-50 text-violet-600" />
        <Stat icon={DollarSign} label="Ad Spend" value={money(d.spend)} tint="bg-amber-50 text-amber-600" />
        <Stat icon={TrendingUp} label="ROAS" value={`${d.roas}x`} tint="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Traffic Sources</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={d.traffic_sources} dataKey="value" nameKey="name" outerRadius={95} label>
                {d.traffic_sources.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">Campaign Revenue vs Spend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.campaigns}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="spent" fill="#94A3B8" radius={[6, 6, 0, 0]} maxBarSize={30} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
