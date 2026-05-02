import { db, candlesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategyConfig =
  | { type: "sma_crossover"; fastPeriod: number; slowPeriod: number }
  | { type: "rsi"; period: number; oversold: number; overbought: number }
  | { type: "bollinger"; period: number; stdDev: number };

export interface TradeRecord {
  time: number;
  type: "BUY" | "SELL";
  price: number;
  shares: number;
  value: number;
  pnl: number;
  pnlPct: number;
  reason: string;
}

export interface BacktestResult {
  symbol: string;
  strategyName: string;
  strategy: StrategyConfig;
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

// ─── Math helpers ─────────────────────────────────────────────────────────────

function sma(values: number[], period: number): number[] {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j]!;
    return sum / period;
  });
}

function rsiSeries(closes: number[], period: number): number[] {
  const result = new Array<number>(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  const changes = closes.map((c, i) => (i === 0 ? 0 : c - closes[i - 1]!));

  // Initial average gain/loss (Wilder's method)
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = changes[i]!;
    if (d > 0) avgGain += d;
    else avgLoss += Math.abs(d);
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const d = changes[i]!;
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  }
  return result;
}

function bollingerBands(closes: number[], period: number, mult: number) {
  const mid = sma(closes, period);
  const upper = new Array<number>(closes.length).fill(NaN);
  const lower = new Array<number>(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const mean = mid[i]!;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j]! - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

// ─── Signal generation ────────────────────────────────────────────────────────

interface Signals {
  buy: boolean[];
  sell: boolean[];
  warmup: number;
  indicatorData?: Record<string, (number | null)[]>;
}

function smaCrossoverSignals(closes: number[], cfg: Extract<StrategyConfig, { type: "sma_crossover" }>): Signals {
  const fast = sma(closes, cfg.fastPeriod);
  const slow = sma(closes, cfg.slowPeriod);
  const buy = new Array<boolean>(closes.length).fill(false);
  const sell = new Array<boolean>(closes.length).fill(false);

  for (let i = cfg.slowPeriod; i < closes.length; i++) {
    const f0 = fast[i]!, s0 = slow[i]!, f1 = fast[i - 1]!, s1 = slow[i - 1]!;
    if (isNaN(f0) || isNaN(s0) || isNaN(f1) || isNaN(s1)) continue;
    if (f0 > s0 && f1 <= s1) buy[i] = true;
    if (f0 < s0 && f1 >= s1) sell[i] = true;
  }
  return { buy, sell, warmup: cfg.slowPeriod, indicatorData: { fast, slow } };
}

function rsiSignals(closes: number[], cfg: Extract<StrategyConfig, { type: "rsi" }>): Signals {
  const rsiVals = rsiSeries(closes, cfg.period);
  const buy = new Array<boolean>(closes.length).fill(false);
  const sell = new Array<boolean>(closes.length).fill(false);

  for (let i = cfg.period + 1; i < closes.length; i++) {
    const r0 = rsiVals[i]!, r1 = rsiVals[i - 1]!;
    if (isNaN(r0) || isNaN(r1)) continue;
    // Buy: RSI crosses INTO oversold zone (momentum shift)
    if (r0 < cfg.oversold && r1 >= cfg.oversold) buy[i] = true;
    // Sell: RSI crosses INTO overbought zone
    if (r0 > cfg.overbought && r1 <= cfg.overbought) sell[i] = true;
  }
  return { buy, sell, warmup: cfg.period + 1, indicatorData: { rsi: rsiVals } };
}

function bollingerSignals(closes: number[], cfg: Extract<StrategyConfig, { type: "bollinger" }>): Signals {
  const { mid, upper, lower } = bollingerBands(closes, cfg.period, cfg.stdDev);
  const buy = new Array<boolean>(closes.length).fill(false);
  const sell = new Array<boolean>(closes.length).fill(false);

  for (let i = cfg.period; i < closes.length; i++) {
    const c0 = closes[i]!, c1 = closes[i - 1]!;
    const l0 = lower[i]!, l1 = lower[i - 1]!;
    const u0 = upper[i]!, u1 = upper[i - 1]!;
    if (isNaN(l0) || isNaN(u0)) continue;
    // Buy: price crosses below lower band (oversold)
    if (c0 < l0 && c1 >= l1) buy[i] = true;
    // Sell: price crosses above upper band (overbought)
    if (c0 > u0 && c1 <= u1) sell[i] = true;
  }
  return { buy, sell, warmup: cfg.period, indicatorData: { upper, lower, mid } };
}

function computeSignals(closes: number[], cfg: StrategyConfig): Signals {
  switch (cfg.type) {
    case "sma_crossover": return smaCrossoverSignals(closes, cfg);
    case "rsi":           return rsiSignals(closes, cfg);
    case "bollinger":     return bollingerSignals(closes, cfg);
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }

function simulate(
  candles: Candle[],
  signals: Signals,
  initialCapital: number,
  daysToSimulate: number,
): { trades: TradeRecord[]; equityCurve: { time: number; value: number; buyHold: number }[] } {
  const n = candles.length;
  const tradeStart = Math.max(signals.warmup, n - daysToSimulate);

  let cash = initialCapital;
  let position = 0;
  let entryValue = 0;
  const trades: TradeRecord[] = [];
  const equityCurve: { time: number; value: number; buyHold: number }[] = [];

  // Buy-and-hold baseline starts at tradeStart price
  const bhStartPrice = candles[tradeStart]?.close ?? candles[0]!.close;

  for (let i = tradeStart; i < n; i++) {
    const c = candles[i]!;
    const equity = cash + position * c.close;
    const bhValue = initialCapital * (c.close / bhStartPrice);
    equityCurve.push({ time: c.time, value: equity, buyHold: bhValue });

    if (signals.buy[i] && position === 0 && cash > 0) {
      position = cash / c.close;
      entryValue = cash;
      cash = 0;
      trades.push({ time: c.time, type: "BUY", price: c.close, shares: position, value: entryValue, pnl: 0, pnlPct: 0, reason: signalLabel(signals, "buy") });
    } else if (signals.sell[i] && position > 0) {
      const saleValue = position * c.close;
      const pnl = saleValue - entryValue;
      trades.push({ time: c.time, type: "SELL", price: c.close, shares: position, value: saleValue, pnl, pnlPct: (pnl / entryValue) * 100, reason: signalLabel(signals, "sell") });
      cash = saleValue;
      position = 0;
    }
  }

  // Close open position at last candle
  if (position > 0) {
    const last = candles[n - 1]!;
    const saleValue = position * last.close;
    const pnl = saleValue - entryValue;
    trades.push({ time: last.time, type: "SELL", price: last.close, shares: position, value: saleValue, pnl, pnlPct: (pnl / entryValue) * 100, reason: "End of backtest" });
    cash = saleValue;
  }

  return { trades, equityCurve };
}

function signalLabel(s: Signals, dir: "buy" | "sell"): string {
  return dir === "buy" ? "Signal: Enter" : "Signal: Exit";
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

function calcMetrics(equityCurve: { value: number }[], sellTrades: TradeRecord[]) {
  const finalCapital = equityCurve.at(-1)?.value ?? 0;
  const initialCapital = equityCurve[0]?.value ?? 0;
  const totalReturnPct = initialCapital > 0 ? ((finalCapital - initialCapital) / initialCapital) * 100 : 0;

  const wins = sellTrades.filter(t => t.pnl > 0);
  const losses = sellTrades.filter(t => t.pnl <= 0);
  const winRate = sellTrades.length > 0 ? (wins.length / sellTrades.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;

  let maxDrawdown = 0, peak = 0;
  for (const p of equityCurve) {
    if (p.value > peak) peak = p.value;
    const dd = peak > 0 ? ((peak - p.value) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const returns = equityCurve.map((p, i) =>
    i === 0 ? 0 : (p.value - equityCurve[i - 1]!.value) / equityCurve[i - 1]!.value
  ).slice(1);
  const meanR = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / (returns.length || 1);
  const sharpeRatio = variance > 0 ? (meanR / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  return { finalCapital, totalReturnPct, winRate, avgWin, avgLoss, maxDrawdown, sharpeRatio, winningTrades: wins.length, losingTrades: losses.length };
}

// ─── Strategy name / warmup ───────────────────────────────────────────────────

export function strategyName(cfg: StrategyConfig): string {
  switch (cfg.type) {
    case "sma_crossover": return `SMA Crossover (${cfg.fastPeriod}/${cfg.slowPeriod})`;
    case "rsi":           return `RSI (${cfg.period}, ${cfg.oversold}/${cfg.overbought})`;
    case "bollinger":     return `Bollinger Bands (${cfg.period}, ${cfg.stdDev}σ)`;
  }
}

export function warmupPeriod(cfg: StrategyConfig): number {
  switch (cfg.type) {
    case "sma_crossover": return cfg.slowPeriod + 1;
    case "rsi":           return cfg.period + 2;
    case "bollinger":     return cfg.period + 1;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runBacktest(
  symbol: string,
  days: number,
  strategy: StrategyConfig,
  initialCapital = 10_000,
  parsedFrom?: string,
): Promise<BacktestResult> {
  const needed = warmupPeriod(strategy) + days + 10; // extra buffer
  const rows = await db
    .select()
    .from(candlesTable)
    .where(and(eq(candlesTable.symbol, symbol.toUpperCase()), eq(candlesTable.interval, "1d")))
    .orderBy(desc(candlesTable.time))
    .limit(needed);

  const candles: Candle[] = rows.reverse().map(r => ({
    time: Number(r.time),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }));

  if (candles.length < 5) throw new Error(`Not enough daily candles for ${symbol} — please restart the server to seed data.`);

  const closes = candles.map(c => c.close);
  const signals = computeSignals(closes, strategy);

  const { trades, equityCurve } = simulate(candles, signals, initialCapital, days);
  const sellTrades = trades.filter(t => t.type === "SELL");
  const metrics = calcMetrics(equityCurve, sellTrades);

  const bhEnd = candles.at(-1)!.close;
  const bhStart = candles[Math.max(0, candles.length - days)]!.close;
  const buyHoldReturnPct = ((bhEnd - bhStart) / bhStart) * 100;

  return {
    symbol: symbol.toUpperCase(),
    strategyName: strategyName(strategy),
    strategy,
    days,
    initialCapital,
    finalCapital: metrics.finalCapital,
    totalReturnPct: metrics.totalReturnPct,
    buyHoldReturnPct,
    winRate: metrics.winRate,
    maxDrawdown: metrics.maxDrawdown,
    totalTrades: sellTrades.length,
    winningTrades: metrics.winningTrades,
    losingTrades: metrics.losingTrades,
    avgWin: metrics.avgWin,
    avgLoss: metrics.avgLoss,
    sharpeRatio: metrics.sharpeRatio,
    trades,
    equityCurve,
    parsedFrom,
  };
}
