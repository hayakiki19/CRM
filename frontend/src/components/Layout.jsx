import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, Kanban, Contact, Building2, Handshake, Briefcase,
  FolderKanban, CheckSquare, FileText, FileSignature, ReceiptText, CreditCard,
  Globe, FormInput, Inbox, BarChart3, Megaphone, PenLine, Mail, Calendar,
  MessageSquare, PieChart, Sparkles, Settings, Search, Bell, LogOut, ChevronDown, Menu, X, Plus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

const NAV = [
  { section: "Overview", items: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { section: "Sales", items: [
    ["Leads", "/leads", Users], ["Pipeline", "/pipeline", Kanban], ["Contacts", "/contacts", Contact],
    ["Companies", "/companies", Building2], ["Deals", "/deals", Handshake],
  ]},
  { section: "Delivery", items: [
    ["Clients", "/clients", Briefcase], ["Projects", "/projects", FolderKanban], ["Tasks", "/tasks", CheckSquare],
  ]},
  { section: "Billing", items: [
    ["Proposals", "/proposals", FileText], ["Contracts", "/contracts", FileSignature],
    ["Invoices", "/invoices", ReceiptText], ["Payments", "/payments", CreditCard],
  ]},
  { section: "Website", items: [
    ["Website Connections", "/websites", Globe], ["Forms", "/forms", FormInput],
    ["Website Leads", "/website-leads", Inbox], ["Analytics", "/analytics", BarChart3],
  ]},
  { section: "Marketing", items: [["Campaigns", "/campaigns", Megaphone], ["Content", "/content", PenLine]] },
  { section: "Communication", items: [
    ["Email", "/email", Mail], ["Calendar", "/calendar", Calendar], ["Messages", "/messages", MessageSquare],
  ]},
  { section: "More", items: [
    ["Reports", "/reports", PieChart], ["AI Assistant", "/ai", Sparkles], ["Settings", "/settings", Settings],
  ]},
];

const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");

export default function Layout({ children }) {
  const { user, org, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const flatNav = NAV.flatMap((g) => g.items.map(([label, path, Icon]) => ({ label, path, Icon })));

  const brandName = org?.name || "FlowCRM";
  const logo = org?.logo_url;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static z-40 h-full w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10 shrink-0">
          {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" /> :
            <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center text-white font-bold">{brandName[0]}</div>}
          <span className="font-display font-bold text-white truncate">{brandName}</span>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {NAV.map((grp) => (
            <div key={grp.section}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{grp.section}</p>
              {grp.items.map(([label, path, Icon]) => (
                <NavLink key={path} to={path} onClick={() => setOpen(false)} data-testid={`nav-${slug(label)}-link`}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-primary text-white font-medium" : "hover:bg-white/5 hover:text-white"}`}>
                  <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-20">
          <button className="lg:hidden text-slate-600" onClick={() => setOpen(true)} data-testid="sidebar-toggle"><Menu className="h-5 w-5" /></button>
          <button onClick={() => setCmdOpen(true)} className="relative flex-1 max-w-md hidden sm:flex items-center gap-2 h-9 rounded-lg bg-slate-50 border border-slate-200 px-3 text-sm text-slate-400 hover:border-slate-300 transition-colors" data-testid="global-search">
            <Search className="h-4 w-4" /> Search or jump to…
            <kbd className="ml-auto text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="quick-add-button"><Plus className="h-4 w-4 mr-1" />New</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Quick create</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/leads?new=1")} data-testid="quick-add-lead">New Lead</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/deals?new=1")} data-testid="quick-add-deal">New Deal</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/clients?new=1")}>New Client</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/tasks?new=1")}>New Task</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/invoices?new=1")}>New Invoice</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button className="h-9 w-9 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-600 relative" data-testid="notifications-button">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg hover:bg-slate-100 px-2 py-1.5" data-testid="user-menu">
                <Avatar className="h-8 w-8"><AvatarImage src={user?.avatar} /><AvatarFallback className="bg-primary text-white text-xs">{(user?.name || "U")[0]}</AvatarFallback></Avatar>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}><Settings className="h-4 w-4 mr-2" />Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { logout(); navigate("/login"); }} data-testid="logout-button"><LogOut className="h-4 w-4 mr-2" />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search sections… (leads, pipeline, invoices)" data-testid="command-input" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {flatNav.map((n) => (
              <CommandItem key={n.path} value={n.label} onSelect={() => { navigate(n.path); setCmdOpen(false); }} data-testid={`command-${slug(n.label)}`}>
                <n.Icon className="h-4 w-4 mr-2 text-slate-500" />{n.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quick create">
            <CommandItem value="new lead create" onSelect={() => { navigate("/leads?new=1"); setCmdOpen(false); }}><Plus className="h-4 w-4 mr-2 text-primary" />New Lead</CommandItem>
            <CommandItem value="new deal create" onSelect={() => { navigate("/deals?new=1"); setCmdOpen(false); }}><Plus className="h-4 w-4 mr-2 text-primary" />New Deal</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
