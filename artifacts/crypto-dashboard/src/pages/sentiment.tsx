import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Gauge, RefreshCw, Brain, TrendingUp, Volume2, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Zone = "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";

interface SentimentData {
  score: number;
  zone: Zone;
  label: string;
  emoji: string;
  factors: { momentum: number; volume: number; social: number };
  history: { date: string; score: number }[];
  quote: string;
  updatedAt: string;
}

// ─── Zone config ──────────────────────────────────────────────────────────────

const ZONE_CONFIG: Record<Zone, { color: string; bg: string; border: string; glow: string }> = {
  extreme_fear:  { color: "#ef4444", bg: "hsl(0,60%,10%)",   border: "hsl(0,65%,35%)",   glow: "#ef444440" },
  fear:          { color: "#f97316", bg: "hsl(20,60%,10%)",  border: "hsl(20,65%,38%)",  glow: "#f9731630" },
  neutral:       { color: "#94a3b8", bg: "hsl(220,15%,12%)", border: "hsl(220,15%,30%)", glow: "#94a3b820" },
  greed:         { color: "#22c55e", bg: "hsl(145,55%,10%)", border: "hsl(145,60%,32%)", glow: "#22c55e30" },
  extreme_greed: { color: "#a855f7", bg: "hsl(270,55%,10%)", border: "hsl(270,65%,40%)", glow: "#a855f740" },
};

// ─── SVG Gauge ────────────────────────────────────────────────────────────────

const CX = 160, CY = 148, R = 112, SW = 22;

const SEGMENTS = [
  { s1: 0,  s2: 25,  color: "#ef4444" },
  { s1: 25, s2: 45,  color: "#f97316" },
  { s1: 45, s2: 55,  color: "#71717a" },
  { s1: 55, s2: 75,  color: "#22c55e" },
  { s1: 75, s2: 100, color: "#a855f7" },
];

function arcPoint(score: number) {
  const angle = Math.PI * (1 - score / 100);
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

function segmentPath(s1: number, s2: number): string {
  const p1 = arcPoint(s1);
  const p2 = arcPoint(s2);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${R} ${R} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

// Tick mark positions at 0, 25, 50, 75, 100
const TICKS = [0, 25, 50, 75, 100];

function SentimentGaugeSVG({ score, zone }: { score: number; zone: Zone }) {
  const cfg = ZONE_CONFIG[zone];
  const needleAngle = (score / 100) * 180 - 90;
  const prevScore = useRef(score);
  const [displayScore, setDisplayScore] = useState(score);

  // Animate displayed score
  useEffect(() => {
    const from = prevScore.current;
    const to = score;
    if (from === to) return;
    const steps = 20;
    const stepSize = (to - from) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplayScore(Math.round(from + stepSize * step));
      if (step >= steps) { clearInterval(interval); prevScore.current = to; }
    }, 40);
    return () => clearInterval(interval);
  }, [score]);

  return (
    <div className="relative flex justify-center">
      <svg viewBox="0 0 320 175" className="w-full max-w-sm" style={{ filter: `drop-shadow(0 0 20px ${cfg.glow})` }}>
        {/* Background arc track */}
        <path
          d={segmentPath(0, 100)}
          fill="none"
          stroke="hsl(220,15%,18%)"
          strokeWidth={SW + 4}
          strokeLinecap="round"
        />

        {/* Colored segment arcs */}
        {SEGMENTS.map(({ s1, s2, color }) => (
          <path
            key={s1}
            d={segmentPath(s1, s2)}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap={s1 === 0 ? "round" : s2 === 100 ? "round" : "butt"}
            opacity={0.9}
          />
        ))}

        {/* Tick marks */}
        {TICKS.map((s) => {
          const inner = arcPoint(s);
          const outerR = R + SW / 2 + 8;
          const angle = Math.PI * (1 - s / 100);
          const ox = CX + outerR * Math.cos(angle);
          const oy = CY - outerR * Math.sin(angle);
          return (
            <g key={s}>
              <line
                x1={inner.x} y1={inner.y} x2={ox} y2={oy}
                stroke="hsl(220,15%,30%)"
                strokeWidth={1.5}
              />
              <text
                x={CX + (outerR + 14) * Math.cos(angle)}
                y={CY - (outerR + 14) * Math.sin(angle)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill="hsl(220,10%,50%)"
              >
                {s}
              </text>
            </g>
          );
        })}

        {/* Needle shadow */}
        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          <line x1={CX} y1={CY + 14} x2={CX} y2={CY - R + 6} stroke="#00000060" strokeWidth={5} strokeLinecap="round" />
        </g>

        {/* Needle */}
        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          <line x1={CX} y1={CY + 12} x2={CX} y2={CY - R + 6} stroke="white" strokeWidth={3} strokeLinecap="round" />
          <line x1={CX} y1={CY + 12} x2={CX} y2={CY - R + 6} stroke={cfg.color} strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
        </g>

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={10} fill="hsl(220,15%,18%)" stroke={cfg.color} strokeWidth={2} />
        <circle cx={CX} cy={CY} r={4} fill={cfg.color} />

        {/* Score display */}
        <text x={CX} y={CY + 30} textAnchor="middle" fontSize={36} fontWeight="700" fontFamily="monospace" fill="white">
          {displayScore}
        </text>
        <text x={CX} y={CY + 48} textAnchor="middle" fontSize={11} fill="hsl(220,10%,55%)">
          out of 100
        </text>
      </svg>
    </div>
  );
}

// ─── Factor bar ───────────────────────────────────────────────────────────────

function FactorBar({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-semibold tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: `linear-gradient(to right, ${color}80, ${color})` }}
        />
      </div>
    </div>
  );
}

// ─── Zone label ───────────────────────────────────────────────────────────────

function ZoneBadge({ zone, label, emoji }: { zone: Zone; label: string; emoji: string }) {
  const cfg = ZONE_CONFIG[zone];
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZONE_CHART_AREAS = [
  { y1: 0,  y2: 25,  fill: "#ef4444" },
  { y1: 25, y2: 45,  fill: "#f97316" },
  { y1: 45, y2: 55,  fill: "#71717a" },
  { y1: 55, y2: 75,  fill: "#22c55e" },
  { y1: 75, y2: 100, fill: "#a855f7" },
];

function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00Z");
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

function zoneLine(score: number): Zone {
  if (score <= 25) return "extreme_fear";
  if (score <= 45) return "fear";
  if (score <= 55) return "neutral";
  if (score <= 75) return "greed";
  return "extreme_greed";
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SentimentPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<SentimentData>({
    queryKey: ["sentiment"],
    queryFn: async () => {
      const res = await fetch("/api/sentiment", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sentiment");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const refreshQuote = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sentiment/refresh-quote", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ quote: string }>;
    },
    onSuccess: (result) => {
      qc.setQueryData<SentimentData>(["sentiment"], (old) =>
        old ? { ...old, quote: result.quote } : old
      );
    },
  });

  const zone = data?.zone ?? "neutral";
  const cfg = ZONE_CONFIG[zone];
  const lastUpdated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Market Sentiment</h1>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                <RefreshCw className="h-3 w-3" /> {lastUpdated}
              </span>
            )}
          </div>
          {data && <ZoneBadge zone={zone} label={data.label} emoji={data.emoji} />}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Analyzing market sentiment…</span>
            </div>
          )}

          {data && (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Gauge + Factors row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Gauge card */}
                <Card
                  className="bg-card"
                  style={{ border: `1px solid ${cfg.border}`, boxShadow: `0 0 24px ${cfg.glow}` }}
                >
                  <CardContent className="pt-5 pb-4">
                    <SentimentGaugeSVG score={data.score} zone={zone} />
                    {/* Zone scale */}
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-2">
                      <span>Extreme Fear</span>
                      <span>Fear</span>
                      <span>Neutral</span>
                      <span>Greed</span>
                      <span>Extreme Greed</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Factors card */}
                <div className="space-y-4">
                  <Card className="bg-card">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Sentiment Drivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-4">
                      <FactorBar
                        label="Price Momentum"
                        value={data.factors.momentum}
                        icon={<TrendingUp className="h-3.5 w-3.5" />}
                        color={ZONE_CONFIG[zoneLine(data.factors.momentum)].color}
                      />
                      <FactorBar
                        label="Volume Activity"
                        value={data.factors.volume}
                        icon={<Volume2 className="h-3.5 w-3.5" />}
                        color={ZONE_CONFIG[zoneLine(data.factors.volume)].color}
                      />
                      <FactorBar
                        label="Social Buzz"
                        value={data.factors.social}
                        icon={<MessageCircle className="h-3.5 w-3.5" />}
                        color={ZONE_CONFIG[zoneLine(data.factors.social)].color}
                      />
                    </CardContent>
                  </Card>

                  {/* Weight breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Momentum", weight: "60%", value: data.factors.momentum },
                      { label: "Volume",   weight: "20%", value: data.factors.volume },
                      { label: "Social",   weight: "20%", value: data.factors.social },
                    ].map((f) => (
                      <div key={f.label} className="bg-secondary/40 rounded-lg px-3 py-2 text-center">
                        <div className="text-xs text-muted-foreground">{f.label}</div>
                        <div className="text-lg font-bold tabular-nums mt-0.5">{f.value}</div>
                        <div className="text-[10px] text-muted-foreground">{f.weight} weight</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Quote */}
              <Card className="bg-card" style={{ border: `1px solid ${cfg.border}20` }}>
                <CardContent className="pt-4 pb-4 px-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                    >
                      <Brain className="h-4 w-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          AI Market Insight
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
                          onClick={() => refreshQuote.mutate()}
                          disabled={refreshQuote.isPending}
                        >
                          {refreshQuote.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><RefreshCw className="h-3 w-3 mr-1" />Refresh</>
                          )}
                        </Button>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: cfg.color }}>
                        "{data.quote}"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 7-Day History Chart */}
              <Card className="bg-card">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-medium">7-Day Sentiment History</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.history} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

                      {/* Zone bands */}
                      {ZONE_CHART_AREAS.map(({ y1, y2, fill }) => (
                        <ReferenceArea key={y1} y1={y1} y2={y2} fill={fill} fillOpacity={0.06} />
                      ))}

                      {/* Zone boundary lines */}
                      {[25, 45, 55, 75].map((v) => (
                        <ReferenceLine key={v} y={v} stroke="hsl(var(--border))" strokeDasharray="4 3" strokeOpacity={0.5} />
                      ))}

                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtDate}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 45, 55, 75, 100]}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        labelFormatter={fmtDate}
                        formatter={(v: number) => {
                          const z = ZONES.find((zz) => v <= zz.max) ?? ZONES[ZONES.length - 1]!;
                          return [`${v} — ${z.emoji} ${z.label}`, "Score"];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={cfg.color}
                        strokeWidth={2.5}
                        fill="url(#sentGrad)"
                        dot={{ r: 4, fill: cfg.color, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                        activeDot={{ r: 6, fill: cfg.color }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Zone legend */}
                  <div className="flex flex-wrap gap-3 mt-3 px-2">
                    {[
                      { label: "Extreme Fear", color: "#ef4444", range: "0–25" },
                      { label: "Fear",          color: "#f97316", range: "26–45" },
                      { label: "Neutral",       color: "#94a3b8", range: "46–55" },
                      { label: "Greed",         color: "#22c55e", range: "56–75" },
                      { label: "Extreme Greed", color: "#a855f7", range: "76–100" },
                    ].map((z) => (
                      <div key={z.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: z.color }} />
                        {z.label} <span className="text-muted-foreground/50">({z.range})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ZONES array for tooltip formatting
const ZONES = [
  { max: 25,  emoji: "🔴", label: "Extreme Fear" },
  { max: 45,  emoji: "🟠", label: "Fear" },
  { max: 55,  emoji: "⚪", label: "Neutral" },
  { max: 75,  emoji: "🟢", label: "Greed" },
  { max: 100, emoji: "🟣", label: "Extreme Greed" },
];
