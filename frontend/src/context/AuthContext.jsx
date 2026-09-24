import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, http } from "@/lib/api";

const AuthContext = createContext(null);

function hexToHsl(hex) {
  if (!hex) return null;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrand(color) {
  const hsl = hexToHsl(color);
  if (hsl) {
    document.documentElement.style.setProperty("--primary", hsl);
    document.documentElement.style.setProperty("--ring", hsl);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon, obj=authed
  const [org, setOrg] = useState(null);

  const loadMe = useCallback(async () => {
    try {
      const data = await apiGet("/auth/me");
      setUser(data.user);
      setOrg(data.org);
      applyBrand(data.org?.primary_color);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) { return; }
    if (localStorage.getItem("crm_token")) loadMe();
    else setUser(false);
  }, [loadMe]);

  const finishAuth = (data) => {
    localStorage.setItem("crm_token", data.token);
    setUser(data.user);
    setOrg(data.org);
    applyBrand(data.org?.primary_color);
    return data;
  };

  const login = async (email, password) => finishAuth(await apiPost("/auth/login", { email, password }));
  const register = async (payload) => finishAuth(await apiPost("/auth/register", payload));
  const googleLogin = async (session_id) => finishAuth(await apiPost("/auth/google", { session_id }));

  const logout = () => {
    localStorage.removeItem("crm_token");
    setUser(false);
    setOrg(null);
  };

  const refreshOrg = async () => {
    const o = await apiGet("/org");
    setOrg(o);
    applyBrand(o?.primary_color);
    return o;
  };

  return (
    <AuthContext.Provider value={{ user, org, setOrg, login, register, googleLogin, logout, refreshOrg, loadMe, http }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
