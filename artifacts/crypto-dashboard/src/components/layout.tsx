import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetAccount } from "@workspace/api-client-react";
import { Activity, LogOut, Briefcase, History, LineChart, Brain } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/wallet-button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: account } = useGetAccount();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg tracking-tight">CryptoDesk</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link href="/" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${location === '/' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
              <span className="flex items-center gap-2"><LineChart className="h-4 w-4"/> Trade</span>
            </Link>
            <Link href="/portfolio" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${location === '/portfolio' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
              <span className="flex items-center gap-2"><Briefcase className="h-4 w-4"/> Portfolio</span>
            </Link>
            <Link href="/history" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${location === '/history' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
              <span className="flex items-center gap-2"><History className="h-4 w-4"/> History</span>
            </Link>
            <Link href="/ai" className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${location === '/ai' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
              <span className="flex items-center gap-2"><Brain className="h-4 w-4"/> AI Assistant</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium">
            DEMO MODE &mdash; Paper Trading
          </Badge>

          <WalletButton />
          
          <div className="flex items-center gap-3 border-l border-border pl-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cash Balance</span>
              <span className="text-sm font-mono font-medium">
                {account ? formatCurrency(account.cashBalance) : "---"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {user?.firstName?.[0] || "U"}
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
