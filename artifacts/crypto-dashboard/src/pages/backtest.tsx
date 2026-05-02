import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  BarChart2,
  GitCompare,
  Loader2,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = "BTC" | "ETH" | "SOL" | "BNB";
type DaysOption = 7 | 30 | 90;
type StrategyType = "sma_crossover" | "rsi" | "bollinger" | "ai";

interface SmaConfig { type: "sma_crossover"; fastPeriod: number; slowPeriod: number }
interface RsiConfig { type: "rsi"; period: number; oversold: number; overbought: number }
interface BollingerConfig { type: "bollinger"; period: number; stdDev: number }
interface AiConfig { type: "ai"; prompt: string }
type StrategyConfig = SmaConfig | RsiConfig | BollingerConfig | AiConfig;

interface TradeRecord {
  time: number;
  type: "BUY" | "SELL";
  price: number;
  shares: number;
  value: number;
  pnl: number;
  pnlPct: number;
  reason: string;
}

interface BacktestResult {
  symbol: string;
  strategyName: string;
  days: number;
  initialCapital: number;
  finalCapital: number;
  totalReturnPct: number;
  buyHoldReturnPct: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  trades: TradeRecord[];
  equityCurve: { time: number; value: number; buyHold: number }[];
  parsedFrom?: string;
}

// ─── Preset strategies ────────────────────────────────────────────────────────

const PRESETS: { label: string; config: StrategyConfig }[] = [
  { label: "SMA 10/20", config: { type: "sma_crossover", fastPeriod: 10, slowPeriod: 20 } },
  { label: "SMA 5/15 (Fast)", config: { type: "sma_crossover", fastPeriod: 5, slowPeriod: 15 } },
  { label: "RSI 14 Classic", config: { type: "rsi", period: 14, oversold: 30, overbought: 70 } },
  { label: "RSI 7 Aggressive", config: { type: "rsi", period: 7, oversold: 25, overbought: 75 } },
  { label: "Bollinger 20/2", config: { type: "bollinger", period: 20, stdDev: 2 } },
  { label: "Bollinger Tight", config: { type: "bollinger", period: 15, stdDev: 1.5 } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtPct(n: number, decimals = 2) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

function colorPct(n: number) {
  return n >= 0 ? "text-emerald-400" : "text-red-400";
}

async function postBacktest(body: object): Promise<BacktestResult> {
  const res = await fetch("/api/backtest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? "Backtest failed");
  }
  return res.json();
}

// ─── Strategy config panel ────────────────────────────────────────────────────

function StrategyPanel({
  config,
  onChange,
}: {
  config: StrategyConfig;
  onChange: (c: StrategyConfig) => void;
}) {
  const inputCls =
    "w-full bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <Tabs
      value={config.type}
      onValueChange={(v) => {
        const t = v as StrategyType;
        if (t === "sma_crossover") onChange({ type: "sma_crossover", fastPeriod: 10, slowPeriod: 20 });
        else if (t === "rsi") onChange({ type: "rsi", period: 14, oversold: 30, overbought: 70 });
        else if (t === "bollinger") onChange({ type: "bollinger", period: 20, stdDev: 2 });
        else onChange({ type: "ai", prompt: "" });
      }}
    >
      <TabsList className="grid grid-cols-4 w-full text-xs h-8">
        <TabsTrigger value="sma_crossover" className="text-xs px-1">SMA</TabsTrigger>
        <TabsTrigger value="rsi" className="text-xs px-1">RSI</TabsTrigger>
        <TabsTrigger value="bollinger" className="text-xs px-1">BB</TabsTrigger>
        <TabsTrigger value="ai" className="text-xs px-1">AI</TabsTrigger>
      </TabsList>

      <TabsContent value="sma_crossover" className="space-y-2 mt-3">
        <p className="text-xs text-muted-foreground">Buy when fast SMA crosses above slow SMA; sell when it crosses below.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Fast Period</label>
            <input
              type="number" min={2} max={50} className={inputCls}
              value={(config as SmaConfig).fastPeriod}
              onChange={(e) => onChange({ ...(config as SmaConfig), fastPeriod: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Slow Period</label>
            <input
              type="number" min={3} max={200} className={inputCls}
              value={(config as SmaConfig).slowPeriod}
              onChange={(e) => onChange({ ...(config as SmaConfig), slowPeriod: +e.target.value })}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rsi" className="space-y-2 mt-3">
        <p className="text-xs text-muted-foreground">Buy when RSI enters oversold zone; sell when it enters overbought zone.</p>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Period</label>
          <input
            type="number" min={2} max={50} className={inputCls}
            value={(config as RsiConfig).period}
            onChange={(e) => onChange({ ...(config as RsiConfig), period: +e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Oversold</label>
            <input
              type="number" min={1} max={49} className={inputCls}
              value={(config as RsiConfig).oversold}
              onChange={(e) => onChange({ ...(config as RsiConfig), oversold: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Overbought</label>
            <input
              type="number" min={51} max={99} className={inputCls}
              value={(config as RsiConfig).overbought}
              onChange={(e) => onChange({ ...(config as RsiConfig), overbought: +e.target.value })}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="bollinger" className="space-y-2 mt-3">
        <p className="text-xs text-muted-foreground">Buy when price crosses below lower band; sell when it crosses above upper band.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Period</label>
            <input
              type="number" min={2} max={100} className={inputCls}
              value={(config as BollingerConfig).period}
              onChange={(e) => onChange({ ...(config as BollingerConfig), period: +e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Std Dev (σ)</label>
            <input
              type="number" min={0.5} max={5} step={0.1} className={inputCls}
              value={(config as BollingerConfig).stdDev}
              onChange={(e) => onChange({ ...(config as BollingerConfig), stdDev: +e.target.value })}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="ai" className="space-y-2 mt-3">
        <p className="text-xs text-muted-foreground">Describe your strategy in plain English. GPT-4o-mini will parse it into a structured strategy.</p>
        <textarea
          rows={4}
          placeholder={"e.g. \"Buy when RSI < 30, sell when RSI > 70\"\n\"Buy on SMA 10/50 crossover\"\n\"Mean reversion using tight Bollinger Bands\""}
          className={cn(inputCls, "resize-none")}
          value={(config as AiConfig).prompt}
          onChange={(e) => onChange({ type: "ai", prompt: e.target.value })}
        />
      </TabsContent>
    </Tabs>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  positive,
  neutral,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  neutral?: boolean;
}) {
  const valueColor = neutral
    ? "text-foreground"
    : positive
    ? "text-emerald-400"
    : "text-red-400";

  return (
    <Card className="bg-card">
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums", valueColor)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Equity curve ─────────────────────────────────────────────────────────────

function EquityCurve({
  resultA,
  resultB,
}: {
  resultA: BacktestResult;
  resultB?: BacktestResult;
}) {
  // Merge datasets on time index
  const data = resultA.equityCurve.map((pt, i) => ({
    time: pt.time,
    strategyA: pt.value,
    buyHold: pt.buyHold,
    strategyB: resultB?.equityCurve[i]?.value ?? undefined,
  }));

  const initial = resultA.initialCapital;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          tickFormatter={fmtDate}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          labelFormatter={(t) => fmtDate(Number(t))}
          formatter={(v: number, name: string) => [
            formatCurrency(v),
            name === "strategyA"
              ? resultA.strategyName
              : name === "strategyB"
              ? resultB?.strategyName ?? "Strategy B"
              : "Buy & Hold",
          ]}
        />
        <ReferenceLine y={initial} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" strokeOpacity={0.4} />
        <Legend
          formatter={(v) =>
            v === "strategyA"
              ? resultA.strategyName
              : v === "strategyB"
              ? resultB?.strategyName ?? "Strategy B"
              : "Buy & Hold"
          }
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
        />
        <Line type="monotone" dataKey="strategyA" stroke="#3b82f6" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="buyHold" stroke="#6b7280" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
        {resultB && (
          <Line type="monotone" dataKey="strategyB" stroke="#f97316" dot={false} strokeWidth={2} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Trade log ────────────────────────────────────────────────────────────────

function TradeLog({ trades }: { trades: TradeRecord[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No trades were executed in this period.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-56">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1.5 pr-3 font-medium">Date</th>
            <th className="text-left py-1.5 pr-3 font-medium">Type</th>
            <th className="text-right py-1.5 pr-3 font-medium">Price</th>
            <th className="text-right py-1.5 pr-3 font-medium">Value</th>
            <th className="text-right py-1.5 pr-3 font-medium">P&L</th>
            <th className="text-right py-1.5 font-medium">P&L %</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
              <td className="py-1.5 pr-3 text-muted-foreground">{fmtDate(t.time)}</td>
              <td className="py-1.5 pr-3">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                    t.type === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  )}
                >
                  {t.type}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(t.price)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(t.value)}</td>
              <td className={cn("py-1.5 pr-3 text-right tabular-nums", t.type === "SELL" ? colorPct(t.pnl) : "text-muted-foreground")}>
                {t.type === "SELL" ? formatCurrency(t.pnl) : "—"}
              </td>
              <td className={cn("py-1.5 text-right tabular-nums", t.type === "SELL" ? colorPct(t.pnlPct) : "text-muted-foreground")}>
                {t.type === "SELL" ? fmtPct(t.pnlPct) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Results panel ────────────────────────────────────────────────────────────

function ResultsPanel({ result, compareResult }: { result: BacktestResult; compareResult?: BacktestResult }) {
  const [tradeTab, setTradeTab] = useState<"a" | "b">("a");

  return (
    <div className="space-y-4">
      {result.parsedFrom && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span><span className="text-foreground font-medium">AI parsed:</span> {result.parsedFrom}</span>
        </div>
      )}

      {/* Summary metrics */}
      {compareResult ? (
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-4 gap-2">
            {[result, compareResult].map((r, idx) => (
              <Card key={idx} className={cn("col-span-2 bg-card border", idx === 0 ? "border-blue-500/30" : "border-orange-500/30")}>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", idx === 0 ? "bg-blue-500" : "bg-orange-500")} />
                    {r.strategyName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Return</span>
                    <span className={cn("font-semibold tabular-nums", colorPct(r.totalReturnPct))}>{fmtPct(r.totalReturnPct)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="font-medium tabular-nums">{r.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Max Drawdown</span>
                    <span className="font-medium tabular-nums text-red-400">-{r.maxDrawdown.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Trades</span>
                    <span className="font-medium tabular-nums">{r.totalTrades}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sharpe</span>
                    <span className="font-medium tabular-nums">{r.sharpeRatio.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard
            label="Total Return"
            value={fmtPct(result.totalReturnPct)}
            sub={`vs Buy & Hold ${fmtPct(result.buyHoldReturnPct)}`}
            positive={result.totalReturnPct >= 0}
          />
          <MetricCard
            label="Win Rate"
            value={`${result.winRate.toFixed(1)}%`}
            sub={`${result.winningTrades}W / ${result.losingTrades}L`}
            positive={result.winRate >= 50}
          />
          <MetricCard
            label="Max Drawdown"
            value={`-${result.maxDrawdown.toFixed(1)}%`}
            sub="peak-to-trough"
            positive={false}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={result.sharpeRatio.toFixed(2)}
            sub={`${result.totalTrades} trades`}
            neutral
          />
        </div>
      )}

      {/* Extended stats row */}
      {!compareResult && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-secondary/40 rounded-md px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Avg Win</p>
            <p className="font-semibold text-emerald-400">{fmtPct(result.avgWin)}</p>
          </div>
          <div className="bg-secondary/40 rounded-md px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Avg Loss</p>
            <p className="font-semibold text-red-400">{fmtPct(result.avgLoss)}</p>
          </div>
          <div className="bg-secondary/40 rounded-md px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Final Capital</p>
            <p className="font-semibold tabular-nums">{formatCurrency(result.finalCapital)}</p>
          </div>
        </div>
      )}

      {/* Equity curve */}
      <Card className="bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            Equity Curve
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <EquityCurve resultA={result} resultB={compareResult} />
        </CardContent>
      </Card>

      {/* Trade log */}
      <Card className="bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Trade Log
            </span>
            {compareResult && (
              <div className="flex gap-1">
                <button
                  onClick={() => setTradeTab("a")}
                  className={cn("text-xs px-2 py-0.5 rounded", tradeTab === "a" ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground")}
                >
                  {result.strategyName}
                </button>
                <button
                  onClick={() => setTradeTab("b")}
                  className={cn("text-xs px-2 py-0.5 rounded", tradeTab === "b" ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground")}
                >
                  {compareResult.strategyName}
                </button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <TradeLog trades={tradeTab === "a" || !compareResult ? result.trades : compareResult.trades} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Backtest() {
  const [asset, setAsset] = useState<Asset>("BTC");
  const [days, setDays] = useState<DaysOption>(30);
  const [strategyA, setStrategyA] = useState<StrategyConfig>({ type: "sma_crossover", fastPeriod: 10, slowPeriod: 20 });
  const [strategyB, setStrategyB] = useState<StrategyConfig>({ type: "rsi", period: 14, oversold: 30, overbought: 70 });
  const [compareMode, setCompareMode] = useState(false);
  const [initialCapital] = useState(10_000);

  const singleMutation = useMutation({
    mutationFn: () => postBacktest({ symbol: asset, days, strategy: strategyA, initialCapital }),
  });

  const compareMutation = useMutation({
    mutationFn: async () => {
      const [a, b] = await Promise.all([
        postBacktest({ symbol: asset, days, strategy: strategyA, initialCapital }),
        postBacktest({ symbol: asset, days, strategy: strategyB, initialCapital }),
      ]);
      return { a, b };
    },
  });

  const isLoading = singleMutation.isPending || compareMutation.isPending;

  const handleRun = () => {
    if (compareMode) {
      compareMutation.mutate();
      singleMutation.reset();
    } else {
      singleMutation.mutate();
      compareMutation.reset();
    }
  };

  const error = singleMutation.error?.message ?? compareMutation.error?.message;
  const resultA = compareMode ? compareMutation.data?.a : singleMutation.data;
  const resultB = compareMode ? compareMutation.data?.b : undefined;

  const ASSETS: Asset[] = ["BTC", "ETH", "SOL", "BNB"];
  const DAYS: DaysOption[] = [7, 30, 90];

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Backtest Studio</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Simulate strategies on 90 days of historical daily candle data
          </p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Config sidebar ── */}
          <aside className="w-72 shrink-0 border-r border-border overflow-y-auto p-4 space-y-5">
            {/* Asset */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">ASSET</p>
              <div className="grid grid-cols-4 gap-1">
                {ASSETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAsset(a)}
                    className={cn(
                      "py-1.5 text-xs font-medium rounded transition-colors",
                      asset === a ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">DATE RANGE</p>
              <div className="grid grid-cols-3 gap-1">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={cn(
                      "py-1.5 text-xs font-medium rounded transition-colors",
                      days === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">QUICK PRESETS</p>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setStrategyA(p.config)}
                    className="text-[10px] px-2 py-1 bg-secondary hover:bg-secondary/70 rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Strategy A */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                {compareMode && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                {compareMode ? "STRATEGY A" : "STRATEGY"}
              </p>
              <StrategyPanel config={strategyA} onChange={setStrategyA} />
            </div>

            {/* Compare toggle */}
            <div>
              <button
                onClick={() => setCompareMode((v) => !v)}
                className={cn(
                  "w-full flex items-center gap-2 justify-center text-xs py-2 rounded border transition-colors",
                  compareMode
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                )}
              >
                <GitCompare className="h-3.5 w-3.5" />
                {compareMode ? "Comparing Strategies" : "Compare Strategies"}
              </button>
            </div>

            {/* Strategy B (compare mode) */}
            {compareMode && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                  STRATEGY B
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setStrategyB(p.config)}
                      className="text-[10px] px-2 py-1 bg-secondary hover:bg-secondary/70 rounded text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <StrategyPanel config={strategyB} onChange={setStrategyB} />
              </div>
            )}

            <Separator />

            {/* Run button */}
            <Button
              className="w-full"
              onClick={handleRun}
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running…</>
              ) : (
                <><FlaskConical className="h-4 w-4 mr-2" />Run Backtest</>
              )}
            </Button>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</p>
            )}
          </aside>

          {/* ── Results area ── */}
          <main className="flex-1 overflow-y-auto p-5">
            {!resultA && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                  <FlaskConical className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-base font-medium text-foreground/70 mb-1">No results yet</p>
                  <p className="text-sm max-w-xs">
                    Configure your asset, date range, and strategy on the left, then click <strong>Run Backtest</strong>.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2 max-w-md text-xs">
                  {[
                    { icon: <TrendingUp className="h-4 w-4" />, label: "Equity Curve", desc: "Visualize portfolio growth vs buy & hold" },
                    { icon: <BarChart2 className="h-4 w-4" />, label: "Full Metrics", desc: "Sharpe ratio, drawdown, win rate & more" },
                    { icon: <GitCompare className="h-4 w-4" />, label: "Compare Mode", desc: "Run two strategies side-by-side" },
                  ].map((f) => (
                    <div key={f.label} className="bg-secondary/30 rounded-lg p-3 text-center">
                      <div className="flex justify-center text-primary mb-1.5">{f.icon}</div>
                      <p className="font-medium text-foreground/80 mb-0.5">{f.label}</p>
                      <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">
                  {compareMode ? "Running both strategies…" : "Simulating strategy…"}
                </p>
              </div>
            )}

            {resultA && !isLoading && (
              <ResultsPanel result={resultA} compareResult={resultB} />
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
