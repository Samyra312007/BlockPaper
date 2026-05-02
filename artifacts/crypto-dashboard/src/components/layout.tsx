import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetAccount } from "@workspace/api-client-react";
import {
  Activity, LogOut, Briefcase, History, LineChart, Brain, Users,
  Trophy, FlaskConical, LayoutGrid, Gauge, Bell, Radio,
  Menu, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/wallet-button";
import { SentinelPill } from "@/components/sentinel-pill";
import { NotificationBell } from "@/components/notification-bell";

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/",          label: "Trade",     icon: LineChart,    match: (l: string) => l === "/" },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase,    match: (l: string) => l === "/portfolio" },
  { href: "/history",   label: "History",   icon: History,      match: (l: string) => l === "/history" },
  { href: "/ai",        label: "AI",        icon: Brain,        match: (l: string) => l === "/ai" },
  { href: "/rooms",     label: "Rooms",     icon: Users,        match: (l: string) => l === "/rooms" || l.startsWith("/room/") },
  { href: "/quests",    label: "Quests",    icon: Trophy,       match: (l: string) => l === "/quests" },
  { href: "/backtest",  label: "Backtest",  icon: FlaskConical, match: (l: string) => l === "/backtest" },
  { href: "/heatmap",   label: "Heatmap",   icon: LayoutGrid,   match: (l: string) => l === "/heatmap" },
  { href: "/sentiment", label: "Sentiment", icon: Gauge,        match: (l: string) => l === "/sentiment" },
  { href: "/alerts",    label: "Alerts",    icon: Bell,         match: (l: string) => l === "/alerts" },
  { href: "/feed",      label: "Feed",      icon: Radio,        match: (l: string) => l === "/feed" },
] as const;

// ─── Sidebar panel ────────────────────────────────────────────────────────────

interface SidebarPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void; // mobile-only: close the overlay
}

function SidebarPanel({ collapsed, onToggle, onClose }: SidebarPanelProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: account } = useGetAccount();
  const isMobile = Boolean(onClose);

  function handleLogout() {
    onClose?.();
    logout();
  }

  return (
    <aside
      className={`
        h-full flex flex-col bg-card border-r border-border shrink-0 overflow-hidden
        transition-[width] duration-200 ease-in-out
        ${isMobile || !collapsed ? "w-[220px]" : "w-[60px]"}
      `}
    >
      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className="h-12 flex items-center border-b border-border shrink-0 px-3 overflow-hidden">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0"
        >
          <Activity className="h-5 w-5 text-primary shrink-0" />
          <span
            className={`font-bold text-lg tracking-tight whitespace-nowrap transition-[opacity,max-width] duration-200 ${
              collapsed && !isMobile ? "opacity-0 max-w-0" : "opacity-100 max-w-[160px]"
            }`}
          >
            BlockPaper
          </span>
        </Link>
      </div>

      {/* ── Collapse toggle — desktop only, sits just below logo ── */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className={`w-full flex items-center h-8 border-b border-border/60 shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors ${
            collapsed ? "justify-center px-0" : "justify-end px-3"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft className="h-3.5 w-3.5" />
          }
        </button>
      )}

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon: Icon, match }) => {
          const active = match(location);
          const isCollapsed = collapsed && !isMobile;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={isCollapsed ? label : undefined}
              className={`
                group flex items-center rounded-lg text-sm font-medium
                transition-colors relative overflow-hidden
                ${isCollapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2.5"}
                ${active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                }
              `}
            >
              {/* Active accent bar — only when expanded */}
              {active && !isCollapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
              )}

              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />

              {/* Label fades out when collapsed */}
              <span
                className={`whitespace-nowrap transition-[opacity,max-width] duration-200 ${
                  isCollapsed ? "opacity-0 max-w-0 overflow-hidden" : "opacity-100 max-w-[140px]"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── User footer ───────────────────────────────────────────── */}
      <div className="border-t border-border shrink-0">
        <div
          className={`py-3 flex items-center overflow-hidden ${
            collapsed && !isMobile ? "justify-center px-0 gap-0" : "px-3 gap-2"
          }`}
        >
          {/* Avatar — always visible */}
          <div
            className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0"
            title={collapsed && !isMobile ? (user?.firstName ?? "Trader") : undefined}
          >
            {user?.firstName?.[0] ?? "U"}
          </div>

          {/* Name + cash — hidden when collapsed */}
          <div
            className={`flex-1 min-w-0 transition-[opacity,max-width] duration-200 ${
              collapsed && !isMobile ? "opacity-0 max-w-0 overflow-hidden" : "opacity-100 max-w-[120px]"
            }`}
          >
            <div className="text-xs font-medium truncate">{user?.firstName ?? "Trader"}</div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">
              {account ? formatCurrency(account.cashBalance) : "—"}
            </div>
          </div>

          {/* Logout — hidden when collapsed */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className={`h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 transition-[opacity,max-width] duration-200 ${
              collapsed && !isMobile ? "opacity-0 max-w-0 overflow-hidden p-0" : "opacity-100"
            }`}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>

      </div>
    </aside>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function readCollapsed(): boolean {
  try { return localStorage.getItem("bp-sidebar-collapsed") === "true"; } catch { return false; }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // Close mobile drawer on navigation
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("bp-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <div className="hidden lg:flex h-full">
        <SidebarPanel collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      {/* ── Mobile sidebar overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            <SidebarPanel
              collapsed={false}
              onToggle={() => {}}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Desktop top bar */}
        <header className="hidden lg:flex h-12 border-b border-border items-center justify-end gap-2 px-4 bg-card shrink-0">
          <SentinelPill />
          <WalletButton />
          <NotificationBell />
        </header>

        {/* Mobile top bar */}
        <header className="lg:hidden h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0 z-40">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg tracking-tight">BlockPaper</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
