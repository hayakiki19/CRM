import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Pipeline from "@/pages/Pipeline";
import Projects from "@/pages/Projects";
import Forms from "@/pages/Forms";
import WebsiteConnections from "@/pages/WebsiteConnections";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import AIAssistant from "@/pages/AIAssistant";
import Settings from "@/pages/Settings";
import ClientPortal from "@/pages/ClientPortal";
import Leads from "@/pages/Leads";
import ResourcePage from "@/pages/ResourcePage";
import { RESOURCE_CONFIGS } from "@/config/resources";

function Spinner() {
  return <div className="min-h-screen grid place-items-center bg-slate-50"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <Spinner />;
  if (user === false) return <Navigate to="/login" replace />;
  if (user.role === "client") return <ClientPortal />;
  return <Layout>{children}</Layout>;
}

const R = (key) => <Protected><ResourcePage cfg={RESOURCE_CONFIGS[key]} key={key} /></Protected>;

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Protected><div /></Protected>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/pipeline" element={<Protected><Pipeline /></Protected>} />
      <Route path="/projects" element={<Protected><Projects /></Protected>} />
      <Route path="/forms" element={<Protected><Forms /></Protected>} />
      <Route path="/websites" element={<Protected><WebsiteConnections /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/ai" element={<Protected><AIAssistant /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/leads" element={<Protected><Leads /></Protected>} />
      <Route path="/contacts" element={R("contacts")} />
      <Route path="/companies" element={R("companies")} />
      <Route path="/deals" element={R("deals")} />
      <Route path="/clients" element={R("clients")} />
      <Route path="/tasks" element={R("tasks")} />
      <Route path="/proposals" element={R("proposals")} />
      <Route path="/contracts" element={R("contracts")} />
      <Route path="/invoices" element={R("invoices")} />
      <Route path="/payments" element={R("payments")} />
      <Route path="/campaigns" element={R("campaigns")} />
      <Route path="/content" element={R("content")} />
      <Route path="/messages" element={R("messages")} />
      <Route path="/email" element={R("email")} />
      <Route path="/calendar" element={R("calendar")} />
      <Route path="/website-leads" element={R("website-leads")} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
