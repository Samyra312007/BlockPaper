import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAllPrices } from "../lib/prices";
import { logger } from "../lib/logger";

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

type Zone = "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";

interface Snapshot {
  score: number;
  zone: Zone;
  label: string;
  emoji: string;
  factors: { momentum: number; volume: number; social: number };
  timestamp: number;
}

// ─── Zone lookup ──────────────────────────────────────────────────────────────

const ZONES: { max: number; zone: Zone; label: string; emoji: string }[] = [
  { max: 25,  zone: "extreme_fear",  label: "Extreme Fear",  emoji: "🔴" },
  { max: 45,  zone: "fear",          label: "Fear",          emoji: "🟠" },
  { max: 55,  zone: "neutral",       label: "Neutral",       emoji: "⚪" },
  { max: 75,  zone: "greed",         label: "Greed",         emoji: "🟢" },
  { max: 100, zone: "extreme_greed", label: "Extreme Greed", emoji: "🟣" },
];

function classify(score: number) {
  return ZONES.find((z) => score <= z.max) ?? ZONES[ZONES.length - 1]!;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

let current: Snapshot | null = null;
let cachedQuote = "";
let quoteAtScore = -999;
let quoteGenerating = false;

// ─── Computation ──────────────────────────────────────────────────────────────

function computeFactors(): { score: number; momentum: number; volume: number; social: number } {
  const prices = getAllPrices();
  const changes = prices.map((p) => p.changePercent24h);
  const avgChange = changes.reduce((a, b) => a + b, 0) / (changes.length || 1);

  // Price momentum (60%): avg 24h change mapped [-10, +10] → [10, 90]
  const momentum = Math.round(Math.max(5, Math.min(95, 50 + avgChange * 4)));

  // Volume simulation (20%): slow sinusoidal oscillations around 52
  const t = Date.now();
  const volume = Math.round(
    Math.max(10, Math.min(90, 52 + Math.sin(t / 3_600_000) * 16 + Math.sin(t / 600_000) * 6))
  );

  // Social buzz (20%): driven by volatility magnitude + slow drift
  const avgAbs = changes.map(Math.abs).reduce((a, b) => a + b, 0) / (changes.length || 1);
  const buzzBase = avgAbs > 3 ? 68 : avgAbs > 1.5 ? 55 : 43;
  const social = Math.round(
    Math.max(10, Math.min(90, buzzBase + Math.sin(t / 900_000) * 12))
  );

  const score = Math.round(Math.max(2, Math.min(98, momentum * 0.6 + volume * 0.2 + social * 0.2)));
  return { score, momentum, volume, social };
}

// Build stable pseudo-historical data seeded by calendar date
function buildHistory(currentScore: number): { date: string; score: number }[] {
  const result: { date: string; score: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const seed = d.getDate() * 7 + d.getMonth() * 31 + d.getFullYear();
    // LCG-based deterministic noise in [-28, +28]
    const noise = Math.round(((seed * 1_103_515_245 + 12_345) & 0x7fff_ffff) % 57) - 28;
    result.push({
      date: d.toISOString().slice(0, 10),
      score: Math.max(4, Math.min(96, currentScore + noise)),
    });
  }
  result.push({ date: now.toISOString().slice(0, 10), score: currentScore });
  return result;
}

// ─── AI quote ─────────────────────────────────────────────────────────────────

async function refreshQuote(score: number, label: string): Promise<void> {
  if (quoteGenerating) return;
  quoteGenerating = true;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a crypto market psychologist. Write a single punchy, insightful sentence (max 22 words) about the current market sentiment. Be specific and actionable — mention whether it's a buying or holding signal.",
        },
        {
          role: "user",
          content: `Sentiment: ${label} (score ${score}/100). Write a sharp market psychology insight for traders.`,
        },
      ],
      temperature: 0.85,
      max_tokens: 60,
    });
    const text = completion.choices[0]?.message.content?.trim() ?? "";
    if (text) {
      cachedQuote = text;
      quoteAtScore = score;
    }
  } catch (err) {
    logger.warn({ err }, "sentiment quote generation failed");
    if (!cachedQuote) {
      cachedQuote = `Markets are at ${score}/100 — ${label}. Watch price action closely before entering new positions.`;
      quoteAtScore = score;
    }
  } finally {
    quoteGenerating = false;
  }
}

// ─── Monitor ──────────────────────────────────────────────────────────────────

function tick(): void {
  const { score, momentum, volume, social } = computeFactors();
  const z = classify(score);
  current = { score, zone: z.zone, label: z.label, emoji: z.emoji, factors: { momentum, volume, social }, timestamp: Date.now() };

  if (Math.abs(score - quoteAtScore) > 8 || !cachedQuote) {
    refreshQuote(score, z.label).catch(() => {});
  }
}

export function startSentimentMonitor(): void {
  tick();
  setInterval(tick, 30_000);
  logger.info("sentiment monitor started");
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/sentiment", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!current) { res.status(503).json({ error: "Sentiment not ready" }); return; }

  res.json({
    score: current.score,
    zone: current.zone,
    label: current.label,
    emoji: current.emoji,
    factors: current.factors,
    history: buildHistory(current.score),
    quote: cachedQuote || `Market sentiment: ${current.label} at ${current.score}/100.`,
    updatedAt: new Date(current.timestamp).toISOString(),
  });
});

router.post("/sentiment/refresh-quote", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!current) { res.status(503).json({ error: "Not ready" }); return; }

  quoteAtScore = -999;
  await refreshQuote(current.score, current.label);
  res.json({ quote: cachedQuote });
});

export default router;
