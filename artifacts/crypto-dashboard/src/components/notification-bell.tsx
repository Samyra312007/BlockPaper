import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Trigger {
  id: number;
  symbol: string;
  condition: string;
  targetPrice: number;
  triggeredPrice: number;
  triggeredAt: string;
}

function fmtPrice(n: number) {
  return n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const seenIds = useRef<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: pending = [] } = useQuery<Trigger[]>({
    queryKey: ["alerts-pending"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/pending", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  // Request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Fire browser notifications for newly seen triggers
  useEffect(() => {
    for (const t of pending) {
      if (seenIds.current.has(t.id)) continue;
      seenIds.current.add(t.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const dir = t.condition === "above" ? "↑ rose above" : "↓ fell below";
        new Notification(`🔔 ${t.symbol} Price Alert`, {
          body: `${t.symbol} ${dir} $${fmtPrice(t.targetPrice)} — now at $${fmtPrice(t.triggeredPrice)}`,
          icon: "/favicon.ico",
          tag: `alert-${t.id}`,
        });
      }
    }
  }, [pending]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const acknowledge = useMutation({
    mutationFn: async () => {
      await fetch("/api/alerts/acknowledge", { method: "POST", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts-pending"] }),
  });

  const unread = pending.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => setOpen((o) => !o)}
        title="Price Alerts"
      >
        {unread > 0 ? <BellRing className="h-4 w-4 text-yellow-400 animate-[wiggle_0.5s_ease-in-out]" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-yellow-400" />
              Alerts
              {unread > 0 && (
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {unread} new
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  onClick={() => { acknowledge.mutate(); }}
                >
                  <Check className="h-3 w-3" /> Mark read
                </button>
              )}
            </div>
          </div>

          {/* Trigger list */}
          {pending.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
              No new alerts
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {pending.map((t) => (
                <div key={t.id} className="px-4 py-3 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ background: t.condition === "above" ? "#16a34a20" : "#dc262620", color: t.condition === "above" ? "#22c55e" : "#ef4444" }}
                        >
                          {t.condition === "above" ? "↑" : "↓"} {t.symbol}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(t.triggeredAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t.condition === "above" ? "Rose above" : "Fell below"}{" "}
                        <span className="text-foreground font-medium">${fmtPrice(t.targetPrice)}</span>
                        {" · "}hit <span className="text-foreground font-medium">${fmtPrice(t.triggeredPrice)}</span>
                      </p>
                    </div>
                    <button
                      className="shrink-0 text-[11px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-medium mt-0.5"
                      onClick={() => { window.location.href = `/?symbol=${t.symbol}`; setOpen(false); }}
                    >
                      Trade <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border bg-secondary/20">
            <button
              className="text-[11px] text-primary hover:underline w-full text-left"
              onClick={() => { window.location.href = "/alerts"; setOpen(false); }}
            >
              Manage all alerts →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
