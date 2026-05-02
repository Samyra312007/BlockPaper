import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetAccount } from "@workspace/api-client-react";
import {
  Activity, LogOut, Briefcase, History, LineChart, Brain, Users,
  Trophy, FlaskConical, LayoutGrid, Gauge, Bell, Radio, Menu, X,
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

function SidebarPanel({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: account } = useGetAccount();

  function handleLogout() {
    onClose?.();
    logout();
  }

  return (
    <aside className="w-[220px] h-full flex flex-col bg-card border-r border-border shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <Activity className="h-5 w-5 text-primary shrink-0" />
          <span className="font-bold text-lg tracking-tight">BlockPaper</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon: Icon, match }) => {
          const active = match(location);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              }`}
            >
              {/* Active accent bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
              )}
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom utilities + user */}
      <div className="border-t border-border shrink-0">
        {/* Tools row */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/60">
          <SentinelPill />
          <WalletButton />
          <NotificationBell />
        </div>

        {/* User info */}
        <div className="px-3 py-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {user?.firstName?.[0] ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{user?.firstName ?? "Trader"}</div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">
              {account ? formatCurrency(account.cashBalance) : "—"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Prevent body scroll when mobile sidebar open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <div className="hidden lg:flex h-full">
        <SidebarPanel />
      </div>

      {/* ── Mobile sidebar overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setSidebarOpen(false)}
        >
          {/* Sidebar panel — stop click propagation so it doesn't close itself */}
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            <SidebarPanel onClose={() => setSidebarOpen(false)} />
          </div>
          {/* Dark backdrop */}
          <div className="flex-1 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile-only top bar */}
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
