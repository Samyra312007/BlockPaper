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

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: account } = useGetAccount();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-border flex items-center px-3 md:px-4 shrink-0 bg-card z-40 relative">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-base md:text-lg tracking-tight">BlockPaper</span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                className={`px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  match(location)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden lg:flex items-center gap-2">
            <SentinelPill />
            <WalletButton />
          </div>

          <NotificationBell />

          {/* Desktop: user + cash */}
          <div className="hidden lg:flex items-center gap-2 border-l border-border pl-3 ml-1">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cash</span>
              <span className="text-sm font-mono font-medium">
                {account ? formatCurrency(account.cashBalance) : "—"}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {user?.firstName?.[0] ?? "U"}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile: hamburger */}
          <button
            className="lg:hidden h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile slide-down menu ──────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-30 bg-background flex flex-col overflow-y-auto">
          <nav className="flex flex-col p-3 gap-0.5">
            {NAV_LINKS.map(({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                  match(location)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile account footer */}
          <div className="mt-auto border-t border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {user?.firstName?.[0] ?? "U"}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user?.firstName ?? "Trader"}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {account ? formatCurrency(account.cashBalance) : "—"} cash
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <WalletButton />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="gap-1.5 text-muted-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ───────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
