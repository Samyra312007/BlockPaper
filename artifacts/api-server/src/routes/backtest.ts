import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { runBacktest, type StrategyConfig } from "../lib/backtest";
import { logger } from "../lib/logger";

const router = Router();

const VALID_SYMBOLS = ["BTC", "ETH", "SOL", "BNB"] as const;
const VALID_DAYS = [7, 30, 90] as const;

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

// ─── Manual validation ────────────────────────────────────────────────────────

function validateStrategy(s: any): StrategyConfig | null {
  if (!s || typeof s.type !== "string") return null;
  if (s.type === "sma_crossover") {
    const fp = Number(s.fastPeriod), sp = Number(s.slowPeriod);
    if (!fp || !sp || fp < 2 || fp > 50 || sp < 3 || sp > 200) return null;
    return { type: "sma_crossover", fastPeriod: fp, slowPeriod: sp };
  }
  if (s.type === "rsi") {
    const p = Number(s.period), ov = Number(s.oversold), ob = Number(s.overbought);
    if (!p || p < 2 || p > 50 || ov < 1 || ov > 49 || ob < 51 || ob > 99) return null;
    return { type: "rsi", period: p, oversold: ov, overbought: ob };
  }
  if (s.type === "bollinger") {
    const p = Number(s.period), sd = Number(s.stdDev);
    if (!p || p < 2 || p > 100 || sd < 0.5 || sd > 5) return null;
    return { type: "bollinger", period: p, stdDev: sd };
  }
  if (s.type === "ai") {
    if (typeof s.prompt !== "string" || s.prompt.length < 5 || s.prompt.length > 500) return null;
    return null; // AI type is resolved before calling runBacktest
  }
  return null;
}

function isAiStrategy(s: any): s is { type: "ai"; prompt: string } {
  return s?.type === "ai" && typeof s.prompt === "string" && s.prompt.length >= 5;
}

// ─── AI strategy parser ───────────────────────────────────────────────────────

async function parseAIStrategy(prompt: string): Promise<{ strategy: StrategyConfig; parsed: string }> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a trading strategy parser. Convert the user's natural language strategy into exactly one of these JSON formats (pick the closest match):

{"type":"sma_crossover","fastPeriod":10,"slowPeriod":20}
  Buy when fast SMA crosses above slow SMA; sell when it crosses below.

{"type":"rsi","period":14,"oversold":30,"overbought":70}
  Buy when RSI crosses into oversold zone; sell when it crosses into overbought zone.

{"type":"bollinger","period":20,"stdDev":2}
  Buy when price crosses below lower band; sell when price crosses above upper band.

Use sensible parameter defaults if the user does not specify all values. Return ONLY the JSON object, nothing else.`,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 80,
  });

  const raw = completion.choices[0]?.message.content?.trim() ?? "{}";
  let obj: any;
  try { obj = JSON.parse(raw); } catch { obj = {}; }

  const validated = validateStrategy(obj);
  if (validated) {
    return { strategy: validated, parsed: `Parsed "${prompt}" → ${obj.type} strategy` };
  }
  return { strategy: { type: "rsi", period: 14, oversold: 30, overbought: 70 }, parsed: `Could not parse "${prompt}" — defaulted to RSI (14, 30/70)` };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/backtest", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { symbol, days, strategy: strategyInput, initialCapital = 10_000 } = req.body ?? {};

  if (!VALID_SYMBOLS.includes(symbol)) {
    res.status(400).json({ error: `symbol must be one of ${VALID_SYMBOLS.join(", ")}` });
    return;
  }
  if (!VALID_DAYS.includes(days)) {
    res.status(400).json({ error: "days must be 7, 30, or 90" });
    return;
  }
  if (typeof initialCapital !== "number" || initialCapital < 100 || initialCapital > 1_000_000) {
    res.status(400).json({ error: "initialCapital must be between 100 and 1,000,000" });
    return;
  }

  let strategy: StrategyConfig;
  let parsedFrom: string | undefined;

  if (isAiStrategy(strategyInput)) {
    try {
      const result = await parseAIStrategy(strategyInput.prompt);
      strategy = result.strategy;
      parsedFrom = result.parsed;
    } catch (err) {
      logger.error({ err }, "AI strategy parse failed");
      strategy = { type: "rsi", period: 14, oversold: 30, overbought: 70 };
      parsedFrom = "AI parse failed — defaulted to RSI (14, 30/70)";
    }
  } else {
    const validated = validateStrategy(strategyInput);
    if (!validated) {
      res.status(400).json({ error: "Invalid strategy configuration" });
      return;
    }
    strategy = validated;
  }

  try {
    const result = await runBacktest(symbol, days, strategy, initialCapital, parsedFrom);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "backtest failed");
    res.status(500).json({ error: err.message ?? "Backtest failed" });
  }
});

router.post("/backtest/compare", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { symbol, days, strategyA: sA, strategyB: sB, initialCapital = 10_000 } = req.body ?? {};

  if (!VALID_SYMBOLS.includes(symbol) || !VALID_DAYS.includes(days)) {
    res.status(400).json({ error: "Invalid symbol or days" });
    return;
  }

  const resolveStrategy = async (s: any): Promise<{ strategy: StrategyConfig; parsedFrom?: string }> => {
    if (isAiStrategy(s)) {
      try {
        const r = await parseAIStrategy(s.prompt);
        return { strategy: r.strategy, parsedFrom: r.parsed };
      } catch {
        return { strategy: { type: "rsi", period: 14, oversold: 30, overbought: 70 }, parsedFrom: "AI parse failed" };
      }
    }
    const validated = validateStrategy(s);
    if (!validated) throw new Error("Invalid strategy configuration");
    return { strategy: validated };
  };

  try {
    const [resolvedA, resolvedB] = await Promise.all([resolveStrategy(sA), resolveStrategy(sB)]);
    const [resultA, resultB] = await Promise.all([
      runBacktest(symbol, days, resolvedA.strategy, initialCapital, resolvedA.parsedFrom),
      runBacktest(symbol, days, resolvedB.strategy, initialCapital, resolvedB.parsedFrom),
    ]);
    res.json({ a: resultA, b: resultB });
  } catch (err: any) {
    logger.error({ err }, "compare backtest failed");
    res.status(500).json({ error: err.message ?? "Compare failed" });
  }
});

export default router;
