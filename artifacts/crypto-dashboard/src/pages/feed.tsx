import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Radio, TrendingUp, TrendingDown, Flame, Trophy, Bell,
  Users, Copy, X, Wifi, WifiOff, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  type: "trade" | "aggregate" | "winner" | "alert";
  symbol: string;
  side?: "buy" | "sell";
  userHash: string;
  message: string;
  detail?: string;
  count?: number;
  profitPct?: number;
  ts: string;
  tags: string[];
}

interface FeedResponse {
  items: FeedItem[];
  activeTraders: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type Filter = "recent" | "hot" | "winners";

const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "recent",  label: "Recent Activity", icon: <Radio className="h-3.5 w-3.5" /> },
  { key: "hot",     label: "Hot Trades",       icon: <Flame className="h-3.5 w-3.5" /> },
  { key: "winners", label: "Big Winners",      icon: <Trophy className="h-3.5 w-3.5" /> },
];

const SYMBOL_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  BNB: "#f3ba2f",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 5)  return "just now";
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

// ─── Feed item card ───────────────────────────────────────────────────────────

function FeedCard({
  item,
  isNew,
  onCopyTrade,
}: {
  item: FeedItem;
  isNew: boolean;
  onCopyTrade: (item: FeedItem) => void;
}) {
  const color = SYMBOL_COLORS[item.symbol] ?? "#94a3b8";
  const isBuy = item.side === "buy";
  const isWinner = item.type === "winner";
  const isAggregate = item.type === "aggregate";
  const isAlert = item.type === "alert";
  const canCopyTrade = (item.type === "trade" && isBuy) || isWinner;

  return (
    <div
      className={cn(
        "group relative px-4 py-3.5 bg-card border rounded-lg transition-all duration-300",
        isNew
          ? "border-primary/40 shadow-[0_0_12px_rgba(var(--primary),0.15)] animate-[fadeSlideIn_0.4s_ease-out]"
          : "border-border hover:border-border/80",
        isWinner && "border-yellow-500/30 bg-yellow-500/5",
        isAggregate && "border-orange-500/20 bg-orange-500/5",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
            isAggregate ? "bg-orange-500/15" :
            isWinner    ? "bg-yellow-500/15" :
            isAlert     ? "bg-blue-500/15"   :
            isBuy       ? "bg-green-500/15"  :
                          "bg-red-500/15",
          )}
        >
          {isAggregate ? <Flame className="h-4 w-4 text-orange-400" /> :
           isWinner    ? <Trophy className="h-4 w-4 text-yellow-400" /> :
           isAlert     ? <Bell className="h-4 w-4 text-blue-400" /> :
           isBuy       ? <TrendingUp className="h-4 w-4 text-green-400" /> :
                         <TrendingDown className="h-4 w-4 text-red-400" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* Symbol pill */}
              <span
                className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded mr-2"
                style={{ background: `${color}20`, color }}
              >
                {item.symbol}
              </span>
              {/* Main message */}
              <span className="text-sm font-medium">{item.message}</span>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(item.ts)}</span>
          </div>

          {/* Detail line */}
          {item.detail && (
            <p className={cn(
              "text-xs mt-1",
              isWinner    ? "text-yellow-400 font-medium" :
              isBuy       ? "text-green-400/80" :
              isAlert     ? "text-blue-400/80"  :
                            "text-muted-foreground",
            )}>
              {item.detail}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-1.5 flex-wrap">
              {item.tags.includes("hot") && item.type !== "aggregate" && (
                <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded-full">🔥 Hot</span>
              )}
              {isWinner && item.profitPct !== undefined && (
                <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded-full font-semibold">
                  +{item.profitPct}% profit
                </span>
              )}
              {isAggregate && item.count !== undefined && (
                <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" /> {item.count} traders
                </span>
              )}
            </div>

            {canCopyTrade && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-primary hover:text-primary/80 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onCopyTrade(item)}
              >
                <Copy className="h-3 w-3" />
                Copy Trade
              </Button>
            )}
          </div>
        </div>
      </div>

      {isNew && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">
          NEW
        </span>
      )}
    </div>
  );
}

// ─── Copy-trade confirmation ──────────────────────────────────────────────────

function CopyTradeModal({
  item,
  onConfirm,
  onCancel,
}: {
  item: FeedItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const color = SYMBOL_COLORS[item.symbol] ?? "#94a3b8";
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <span className="font-semibold flex items-center gap-2">
            <Copy className="h-4 w-4 text-primary" />
            Copy Trade
          </span>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div
            className="px-4 py-3 rounded-lg text-sm font-medium"
            style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}
          >
            {item.message}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This will open the trading terminal for{" "}
            <span className="text-foreground font-semibold">{item.symbol}</span>. Always review
            the current price and market conditions before placing any order —{" "}
            <span className="text-foreground">this is your own trading decision.</span>
          </p>
          <div className="flex gap-3">
            <Button className="flex-1 gap-2" onClick={onConfirm}>
              <TrendingUp className="h-4 w-4" />
              Open Terminal
            </Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("recent");
  const [wsConnected, setWsConnected] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [copyItem, setCopyItem] = useState<FeedItem | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const newIdTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Initial feed load
  const { data, isLoading, refetch } = useQuery<FeedResponse>({
    queryKey: ["feed", filter],
    queryFn: async () => {
      const res = await fetch(`/api/feed?filter=${filter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load feed");
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 60_000,
  });

  // Mark item as "new" briefly then clear
  const markNew = useCallback((id: string) => {
    setNewIds((prev) => new Set([...prev, id]));
    const t = setTimeout(() => {
      setNewIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 8000);
    newIdTimers.current.set(id, t);
  }, []);

  // WebSocket for live updates
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      if (dead) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/api/ws`);
      wsRef.current = ws;

      ws.onopen  = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type !== "feed_update" || !Array.isArray(msg.items)) return;
          const incoming = msg.items as FeedItem[];
          if (incoming.length === 0) return;

          // Merge into query cache
          qc.setQueryData<FeedResponse>(["feed", filter], (old) => {
            if (!old) return old;
            const existingIds = new Set(old.items.map((i) => i.id));
            const fresh = incoming.filter((i) => !existingIds.has(i.id));
            if (fresh.length === 0) return old;
            fresh.forEach((i) => markNew(i.id));
            return {
              ...old,
              items: [...fresh, ...old.items].slice(0, 100),
            };
          });

          // Also update other filter caches
          for (const f of ["recent", "hot", "winners"] as Filter[]) {
            if (f === filter) continue;
            qc.setQueryData<FeedResponse>(["feed", f], (old) => {
              if (!old) return old;
              const tag = f === "recent" ? null : f;
              const relevant = tag ? incoming.filter((i) => i.tags.includes(tag)) : incoming;
              if (relevant.length === 0) return old;
              const existingIds = new Set(old.items.map((i) => i.id));
              const fresh = relevant.filter((i) => !existingIds.has(i.id));
              if (fresh.length === 0) return old;
              return { ...old, items: [...fresh, ...old.items].slice(0, 100) };
            });
          }
        } catch {}
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      for (const t of newIdTimers.current.values()) clearTimeout(t);
    };
  }, [filter, qc, markNew]);

  const items = data?.items ?? [];
  const activeTraders = data?.activeTraders ?? 0;

  return (
    <Layout>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                <h1 className="text-base font-semibold">Activity Feed</h1>
              </div>
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 text-xs">
                {wsConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                    </span>
                    <span className="text-green-400 font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Connecting…</span>
                  </>
                )}
              </div>
              {activeTraders > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {activeTraders} traders active
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="max-w-2xl mx-auto space-y-2.5">
            {isLoading && (
              <div className="flex flex-col gap-2.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-20 bg-card border border-border rounded-lg animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && items.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Radio className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs mt-1">
                  {filter === "winners"
                    ? "Big winning trades will appear here"
                    : filter === "hot"
                    ? "Trending trades will appear here"
                    : "Trade activity will appear here"}
                </p>
              </div>
            )}

            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                isNew={newIds.has(item.id)}
                onCopyTrade={setCopyItem}
              />
            ))}

            {items.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Showing {items.length} recent activities
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Copy trade confirmation modal */}
      {copyItem && (
        <CopyTradeModal
          item={copyItem}
          onConfirm={() => {
            window.location.href = `/?symbol=${copyItem.symbol}`;
            setCopyItem(null);
          }}
          onCancel={() => setCopyItem(null)}
        />
      )}
    </Layout>
  );
}
