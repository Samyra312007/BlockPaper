import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LayoutGrid, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeatTile {
  symbol: string;
  name: string;
  price: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  change7d: number;
  allocation: number;
  holdingValue: number;
  quantity: number;
  averageCost: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

type Metric = "24h" | "7d" | "pnl";

// ─── Heat color engine ────────────────────────────────────────────────────────

interface HeatColors {
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  priceText: string;
  label: string;
}

function heatColors(pct: number): HeatColors {
  const abs = Math.min(Math.abs(pct), 15);
  const intensity = abs / 15; // 0→1

  if (pct >= 10) {
    return {
      bg: "hsl(145,72%,10%)",
      border: "hsl(145,80%,40%)",
      badgeBg: "hsl(145,75%,16%)",
      badgeText: "hsl(145,90%,72%)",
      priceText: "hsl(145,70%,82%)",
      label: "Neon Green (+10%+)",
    };
  }
  if (pct >= 5) {
    return {
      bg: "hsl(145,60%,10%)",
      border: "hsl(145,65%,32%)",
      badgeBg: "hsl(145,60%,14%)",
      badgeText: "hsl(145,80%,68%)",
      priceText: "hsl(145,60%,78%)",
      label: "Deep Green (+5% to +10%)",
    };
  }
  if (pct >= 2) {
    return {
      bg: "hsl(145,45%,9%)",
      border: "hsl(145,50%,24%)",
      badgeBg: "hsl(145,45%,12%)",
      badgeText: "hsl(145,65%,62%)",
      priceText: "hsl(145,50%,74%)",
      label: "Light Green (+2% to +5%)",
    };
  }
  if (pct >= 0) {
    return {
      bg: "hsl(145,25%,8%)",
      border: "hsl(145,30%,18%)",
      badgeBg: "hsl(145,25%,11%)",
      badgeText: "hsl(145,50%,55%)",
      priceText: "hsl(0,0%,88%)",
      label: "Mild Green (0% to +2%)",
    };
  }
  if (pct >= -2) {
    return {
      bg: "hsl(45,35%,8%)",
      border: "hsl(45,40%,22%)",
      badgeBg: "hsl(45,35%,12%)",
      badgeText: "hsl(45,80%,62%)",
      priceText: "hsl(0,0%,85%)",
      label: "Yellow (-2% to 0%)",
    };
  }
  if (pct >= -5) {
    return {
      bg: "hsl(20,45%,9%)",
      border: "hsl(20,55%,26%)",
      badgeBg: "hsl(20,45%,13%)",
      badgeText: "hsl(20,80%,65%)",
      priceText: "hsl(0,0%,83%)",
      label: "Orange (-5% to -2%)",
    };
  }
  if (pct >= -10) {
    return {
      bg: "hsl(0,50%,10%)",
      border: "hsl(0,60%,30%)",
      badgeBg: "hsl(0,50%,14%)",
      badgeText: "hsl(0,80%,68%)",
      priceText: "hsl(0,0%,82%)",
      label: "Red (-10% to -5%)",
    };
  }
  return {
    bg: "hsl(0,65%,9%)",
    border: "hsl(0,70%,38%)",
    badgeBg: "hsl(0,65%,13%)",
    badgeText: "hsl(0,90%,72%)",
    priceText: "hsl(0,0%,80%)",
    label: "Deep Red (-10% or worse)",
  };
}

function metricValue(tile: HeatTile, metric: Metric): number {
  if (metric === "24h") return tile.change24h;
  if (metric === "7d") return tile.change7d;
  return tile.unrealizedPnlPct;
}

function metricLabel(metric: Metric): string {
  if (metric === "24h") return "24h";
  if (metric === "7d") return "7d";
  return "P&L";
}

function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND = [
  { label: "≤ −10%", bg: "hsl(0,65%,9%)", border: "hsl(0,70%,38%)", text: "hsl(0,90%,72%)" },
  { label: "−10 → −5%", bg: "hsl(0,50%,10%)", border: "hsl(0,60%,30%)", text: "hsl(0,80%,68%)" },
  { label: "−5 → −2%", bg: "hsl(20,45%,9%)", border: "hsl(20,55%,26%)", text: "hsl(20,80%,65%)" },
  { label: "−2 → 0%", bg: "hsl(45,35%,8%)", border: "hsl(45,40%,22%)", text: "hsl(45,80%,62%)" },
  { label: "0 → +2%", bg: "hsl(145,25%,8%)", border: "hsl(145,30%,18%)", text: "hsl(145,50%,55%)" },
  { label: "+2 → +5%", bg: "hsl(145,45%,9%)", border: "hsl(145,50%,24%)", text: "hsl(145,65%,62%)" },
  { label: "+5 → +10%", bg: "hsl(145,60%,10%)", border: "hsl(145,65%,32%)", text: "hsl(145,80%,68%)" },
  { label: "≥ +10%", bg: "hsl(145,72%,10%)", border: "hsl(145,80%,40%)", text: "hsl(145,90%,72%)" },
];

// ─── Tile ─────────────────────────────────────────────────────────────────────

function HeatTileCard({ tile, metric, onClick }: { tile: HeatTile; metric: Metric; onClick: () => void }) {
  const val = metricValue(tile, metric);
  const colors = heatColors(val);
  const hasHolding = tile.quantity > 0;
  const TrendIcon = val > 0 ? TrendingUp : val < 0 ? TrendingDown : Minus;

  return (
    <div className="group relative">
      {/* Main tile */}
      <button
        onClick={onClick}
        className="w-full text-left rounded-xl p-4 transition-all duration-200 hover:scale-[1.03] hover:z-10 relative focus:outline-none focus:ring-2 focus:ring-white/20"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: `0 0 0 0 ${colors.border}`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px 2px ${colors.border}40`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Top row: symbol + change badge */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-lg font-bold text-white leading-none">{tile.symbol}</div>
            <div className="text-xs mt-0.5" style={{ color: colors.badgeText + "99" }}>{tile.name}</div>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold tabular-nums"
            style={{ background: colors.badgeBg, color: colors.badgeText, border: `1px solid ${colors.border}` }}
          >
            <TrendIcon className="h-3 w-3" />
            {fmtPct(val)}
          </div>
        </div>

        {/* Price */}
        <div
          className="text-2xl font-bold tabular-nums mb-3 font-mono"
          style={{ color: colors.priceText }}
        >
          {fmtPrice(tile.price)}
        </div>

        {/* Allocation bar (only if holding) */}
        {hasHolding ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs" style={{ color: colors.badgeText + "cc" }}>
              <span>Allocation</span>
              <span className="font-semibold tabular-nums">{tile.allocation.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: colors.border + "33" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, tile.allocation)}%`,
                  background: colors.border,
                }}
              />
            </div>
            <div className="text-xs tabular-nums" style={{ color: colors.badgeText + "99" }}>
              {formatCurrency(tile.holdingValue)} · {tile.quantity.toFixed(4)} {tile.symbol}
            </div>
          </div>
        ) : (
          <div className="text-xs" style={{ color: colors.badgeText + "55" }}>
            No position · click to trade
          </div>
        )}

        {/* Metric label */}
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-medium tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: colors.badgeText + "88" }}
        >
          {metricLabel(metric)} change
        </div>
      </button>

      {/* Tooltip on hover */}
      <div
        className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none z-50"
        style={{ minWidth: "200px" }}
      >
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs shadow-2xl space-y-1.5">
          <div className="font-semibold text-white mb-2">
            {tile.symbol} · {tile.name}
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Price</span>
            <span className="text-white font-mono">{fmtPrice(tile.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">24h Change</span>
            <span className={tile.change24h >= 0 ? "text-emerald-400" : "text-red-400"}>
              {fmtPct(tile.change24h)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">7d Change</span>
            <span className={tile.change7d >= 0 ? "text-emerald-400" : "text-red-400"}>
              {fmtPct(tile.change7d)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">24h High</span>
            <span className="text-white font-mono">{fmtPrice(tile.high24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">24h Low</span>
            <span className="text-white font-mono">{fmtPrice(tile.low24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Volume 24h</span>
            <span className="text-white font-mono">
              ${(tile.volume24h / 1e6).toFixed(1)}M
            </span>
          </div>
          {tile.quantity > 0 && (
            <>
              <div className="border-t border-zinc-700 my-1.5" />
              <div className="flex justify-between">
                <span className="text-zinc-400">Your Position</span>
                <span className="text-white tabular-nums">{tile.quantity.toFixed(4)} {tile.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Avg Cost</span>
                <span className="text-white font-mono">{fmtPrice(tile.averageCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Unrealized P&L</span>
                <span className={tile.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {tile.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(tile.unrealizedPnl)}
                  {" "}({fmtPct(tile.unrealizedPnlPct)})
                </span>
              </div>
            </>
          )}
          <div className="border-t border-zinc-700 pt-1.5 text-zinc-500 text-[10px]">
            Click to open chart →
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Heatmap() {
  const [metric, setMetric] = useState<Metric>("24h");
  const [, navigate] = useLocation();

  const { data: tiles, isLoading, dataUpdatedAt, isError } = useQuery<HeatTile[]>({
    queryKey: ["heatmap", metric],
    queryFn: async () => {
      const res = await fetch("/api/heatmap", { credentials: "include" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as any).error ?? "Failed to load heatmap");
      }
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-3 shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Portfolio Heatmap</h1>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {lastUpdated}
              </span>
            )}
          </div>

          {/* Heat Intensity Toggle */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {(["24h", "7d", "pnl"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
                  metric === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "24h" ? "24h Change" : m === "7d" ? "7d Change" : "Total P&L"}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-44 rounded-xl bg-secondary/30 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Failed to load heatmap data. Please try again.
            </div>
          )}

          {tiles && (
            <div className="space-y-6">
              {/* Tiles grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tiles.map((tile) => (
                  <HeatTileCard
                    key={tile.symbol}
                    tile={tile}
                    metric={metric}
                    onClick={() => navigate(`/?symbol=${tile.symbol}`)}
                  />
                ))}
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {tiles.map((tile) => {
                  const val = metricValue(tile, metric);
                  const colors = heatColors(val);
                  return (
                    <div
                      key={tile.symbol}
                      className="rounded-lg px-3 py-2 flex items-center justify-between text-sm"
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                    >
                      <span className="font-medium text-white">{tile.symbol}</span>
                      <span
                        className="font-semibold tabular-nums text-xs"
                        style={{ color: colors.badgeText }}
                      >
                        {fmtPct(val)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
                  Color Scale
                </p>
                <div className="flex flex-wrap gap-2">
                  {LEGEND.map((l) => (
                    <div
                      key={l.label}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ background: l.bg, border: `1px solid ${l.border}`, color: l.text }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: l.border }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
