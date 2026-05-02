import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bell, BellPlus, Trash2, ArrowUpRight, Clock, CheckCircle2,
  TrendingUp, TrendingDown, RefreshCw, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceAlert {
  id: number;
  symbol: string;
  condition: string;
  targetPrice: number;
  recurring: boolean;
  active: boolean;
  createdAt: string;
}

interface AlertTrigger {
  id: number;
  alertId: number;
  symbol: string;
  condition: string;
  targetPrice: number;
  triggeredPrice: number;
  triggeredAt: string;
  acknowledged: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ALERTS = 10;
const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"];

function fmtPrice(n: number) {
  return n >= 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "history">("active");

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<PriceAlert[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch("/api/alerts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load alerts");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery<AlertTrigger[]>({
    queryKey: ["alerts-history"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/history", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: tab === "history",
    staleTime: 10_000,
  });

  // ── Create form state ────────────────────────────────────────────────────────

  const [form, setForm] = useState({
    symbol: "BTC",
    condition: "above" as "above" | "below",
    targetPrice: "",
    recurring: false,
  });
  const [formError, setFormError] = useState("");

  const createAlert = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch("/api/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, targetPrice: Number(body.targetPrice) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create alert");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setForm((f) => ({ ...f, targetPrice: "" }));
      setFormError("");
      // Request browser notification permission when first alert is created
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/alerts/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const price = Number(form.targetPrice);
    if (!price || price <= 0) { setFormError("Enter a valid target price"); return; }
    createAlert.mutate(form);
  }

  const atLimit = alerts.length >= MAX_ALERTS;

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Price Alerts</h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {alerts.length}/{MAX_ALERTS} active
            </span>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {(["active", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "active" ? "Active Alerts" : "Trigger History"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* ── Active tab ── */}
            {tab === "active" && (
              <>
                {/* Create form */}
                <Card className="bg-card">
                  <CardHeader className="pb-3 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BellPlus className="h-4 w-4 text-primary" />
                      New Price Alert
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <form onSubmit={handleCreate} className="space-y-4">
                      {/* Row 1: symbol + condition */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Symbol */}
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground font-medium">Asset</label>
                          <div className="grid grid-cols-4 gap-1">
                            {SYMBOLS.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, symbol: s }))}
                                className={cn(
                                  "py-2 text-xs font-bold rounded-md border transition-colors",
                                  form.symbol === s
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Condition */}
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground font-medium">Condition</label>
                          <div className="grid grid-cols-2 gap-1">
                            {(["above", "below"] as const).map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, condition: c }))}
                                className={cn(
                                  "py-2 text-xs font-semibold rounded-md border transition-colors flex items-center justify-center gap-1",
                                  form.condition === c
                                    ? c === "above"
                                      ? "bg-green-500/20 border-green-500/50 text-green-400"
                                      : "bg-red-500/20 border-red-500/50 text-red-400"
                                    : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {c === "above" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {c === "above" ? "Above" : "Below"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: target price */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-medium">
                          Target Price — Alert when {form.symbol} goes {form.condition} this price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="e.g. 50000"
                            value={form.targetPrice}
                            onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))}
                            className="pl-7 font-mono"
                          />
                        </div>
                      </div>

                      {/* Row 3: recurring toggle + submit */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <div
                            onClick={() => setForm((f) => ({ ...f, recurring: !f.recurring }))}
                            className={cn(
                              "relative w-9 h-5 rounded-full transition-colors cursor-pointer",
                              form.recurring ? "bg-primary" : "bg-secondary border border-border",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                                form.recurring ? "translate-x-4" : "translate-x-0.5",
                              )}
                            />
                          </div>
                          <span className="text-sm">
                            Recurring
                            <span className="text-xs text-muted-foreground ml-1">(re-fires every 5 min)</span>
                          </span>
                        </label>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={createAlert.isPending || atLimit}
                          className="gap-2"
                        >
                          {createAlert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellPlus className="h-3.5 w-3.5" />}
                          Set Alert
                        </Button>
                      </div>

                      {/* Errors & limit warning */}
                      {formError && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" /> {formError}
                        </p>
                      )}
                      {atLimit && (
                        <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          You've reached the {MAX_ALERTS}-alert limit. Delete one to add more.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>

                {/* Active alerts list */}
                <div className="space-y-2">
                  {alertsLoading && (
                    <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts…
                    </div>
                  )}
                  {!alertsLoading && alerts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No active alerts</p>
                      <p className="text-xs mt-1">Create one above to get notified when prices move</p>
                    </div>
                  )}
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            alert.condition === "above" ? "bg-green-500/15" : "bg-red-500/15",
                          )}
                        >
                          {alert.condition === "above"
                            ? <TrendingUp className="h-4 w-4 text-green-400" />
                            : <TrendingDown className="h-4 w-4 text-red-400" />
                          }
                        </span>
                        <div>
                          <div className="text-sm font-semibold">
                            {alert.symbol}{" "}
                            <span className={alert.condition === "above" ? "text-green-400" : "text-red-400"}>
                              {alert.condition === "above" ? "above" : "below"}
                            </span>{" "}
                            <span className="font-mono">${fmtPrice(alert.targetPrice)}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {alert.recurring ? (
                              <span className="flex items-center gap-1 text-blue-400">
                                <RefreshCw className="h-2.5 w-2.5" /> Recurring
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> One-time
                              </span>
                            )}
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(alert.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => deleteAlert.mutate(alert.id)}
                        disabled={deleteAlert.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── History tab ── */}
            {tab === "history" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Last 50 triggered alerts</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => refetchHistory()}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </div>

                {historyLoading && (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                  </div>
                )}

                {!historyLoading && history.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No alerts triggered yet</p>
                    <p className="text-xs mt-1">Alerts will appear here when price conditions are met</p>
                  </div>
                )}

                {history.map((t) => {
                  const isAbove = t.condition === "above";
                  const hitTarget = isAbove
                    ? t.triggeredPrice >= t.targetPrice
                    : t.triggeredPrice <= t.targetPrice;
                  const priceDiff = ((t.triggeredPrice - t.targetPrice) / t.targetPrice) * 100;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-3.5 bg-card border rounded-lg",
                        !t.acknowledged ? "border-yellow-500/30 bg-yellow-500/5" : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                            isAbove ? "bg-green-500/15" : "bg-red-500/15",
                          )}
                        >
                          {isAbove
                            ? <TrendingUp className="h-4 w-4 text-green-400" />
                            : <TrendingDown className="h-4 w-4 text-red-400" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold">{t.symbol}</span>
                            <span className={cn("text-xs font-medium", isAbove ? "text-green-400" : "text-red-400")}>
                              {isAbove ? "↑ rose above" : "↓ fell below"} ${fmtPrice(t.targetPrice)}
                            </span>
                            {!t.acknowledged && (
                              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">NEW</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>
                              Hit <span className="text-foreground font-mono font-medium">${fmtPrice(t.triggeredPrice)}</span>
                            </span>
                            <span className={cn("font-medium", hitTarget ? (isAbove ? "text-green-400" : "text-red-400") : "text-muted-foreground")}>
                              ({priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(2)}%)
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {fmtTime(t.triggeredAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Copy trade button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 shrink-0"
                        onClick={() => { window.location.href = `/?symbol=${t.symbol}`; }}
                      >
                        Trade {t.symbol}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
