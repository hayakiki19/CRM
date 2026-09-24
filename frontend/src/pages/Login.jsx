import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutGrid, TrendingUp, Users, Zap } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", org_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  const googleAuth = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="flex items-center gap-2 relative z-10">
          <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center"><LayoutGrid className="h-5 w-5" /></div>
          <span className="font-display text-xl font-bold">FlowCRM</span>
        </div>
        <div className="relative z-10 space-y-8">
          <h1 className="font-display text-4xl font-bold leading-tight">The all-in-one CRM for growing teams.</h1>
          <p className="text-slate-300 text-base max-w-md">Leads, pipeline, projects, invoices, website capture and an AI assistant — one workspace for your whole revenue journey.</p>
          <div className="grid grid-cols-2 gap-5 max-w-md">
            {[[TrendingUp, "Visual sales pipeline"], [Users, "Client portal & projects"], [Zap, "Website lead capture"], [LayoutGrid, "AI assistant"]].map(([Icon, t], i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-200">
                <div className="h-9 w-9 rounded-lg bg-white/10 grid place-items-center"><Icon className="h-4 w-4" /></div>{t}
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-500 text-xs relative z-10">© {new Date().getFullYear()} FlowCRM</p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center text-white"><LayoutGrid className="h-5 w-5" /></div>
            <span className="font-display text-xl font-bold">FlowCRM</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900">{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">{mode === "login" ? "Sign in to your CRM workspace." : "Start managing leads in minutes."}</p>

          <Button variant="outline" className="w-full mb-4" onClick={googleAuth} data-testid="google-login-button">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-4 w-4 mr-2" />
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 my-4 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> OR <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div><Label>Your name</Label><Input value={form.name} onChange={upd("name")} required data-testid="register-name-input" placeholder="Jane Doe" /></div>
                <div><Label>Organization name</Label><Input value={form.org_name} onChange={upd("org_name")} required data-testid="register-org-input" placeholder="Acme Inc" /></div>
              </>
            )}
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={upd("email")} required data-testid="login-email-input" placeholder="you@company.com" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={upd("password")} required data-testid="login-password-input" placeholder="••••••••" /></div>
            {error && <p className="text-sm text-rose-600" data-testid="auth-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="auth-submit-button">
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create workspace"}
            </Button>
          </form>

          <p className="text-sm text-slate-500 mt-6 text-center">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button className="text-primary font-medium" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} data-testid="toggle-auth-mode">
              {mode === "login" ? "Create a workspace" : "Sign in"}
            </button>
          </p>
          {mode === "login" && (
            <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-600 mb-1">Demo accounts</p>
              <p>Owner: glennmuyskens78776@outlook.com / Admin@12345</p>
              <p>Client portal: client@demo.com / Client@12345</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
