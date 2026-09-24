import { Badge } from "@/components/ui/badge";

const MAP = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Contacted: "bg-sky-50 text-sky-700 border-sky-200",
  Qualified: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Meeting: "bg-violet-50 text-violet-700 border-violet-200",
  Proposal: "bg-amber-50 text-amber-700 border-amber-200",
  Negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Lost: "bg-rose-50 text-rose-700 border-rose-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  unpaid: "bg-rose-50 text-rose-700 border-rose-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  todo: "bg-slate-100 text-slate-700 border-slate-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Sent: "bg-sky-50 text-sky-700 border-sky-200",
  Viewed: "bg-violet-50 text-violet-700 border-violet-200",
  Expired: "bg-slate-100 text-slate-500 border-slate-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function StatusBadge({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const cls = MAP[value] || "bg-slate-100 text-slate-700 border-slate-200";
  return <Badge variant="outline" className={`font-medium capitalize ${cls}`}>{String(value).replace(/_/g, " ")}</Badge>;
}
