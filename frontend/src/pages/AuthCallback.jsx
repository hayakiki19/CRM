import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash;
    const match = /session_id=([^&]+)/.exec(hash);
    if (!match) { navigate("/login"); return; }
    (async () => {
      try {
        await googleLogin(match[1]);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard");
      } catch {
        navigate("/login");
      }
    })();
  }, [googleLogin, navigate, location.hash]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Signing you in…</p>
      </div>
    </div>
  );
}
