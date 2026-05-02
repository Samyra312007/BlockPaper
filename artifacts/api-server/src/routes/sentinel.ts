import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getAllPrices } from "../lib/prices";
import { getCandles } from "../lib/candles";
import { logger } from "../lib/logger";

const router = Router();

type SentinelStatus = "SECURE" | "REVIEW" | "ALERT";

interface SentinelResult {
  status: SentinelStatus;
  score: number;
  summary: string;
  findings: string[];
  checkedAt: string;
}

let cachedResult: SentinelResult | null = null;
let scanInProgress = false;

function scoreToStatus(score: number): SentinelStatus {
  if (score >= 70) return "SECURE";
  if (score >= 40) return "REVIEW";
  return "ALERT";
}

async function runSentinelScan(): Promise<void> {
  if (scanInProgress) return;
  scanInProgress = true;

  try {
    const prices = getAllPrices();
    const now = Date.now();

    const priceLines = prices
      .map((p) => {
        const msSinceUpdate = now - p.updatedAt.getTime();
        return `${p.symbol}: price=$${p.price.toFixed(2)}, 24h_change=${p.changePercent24h.toFixed(2)}%, volume=$${(p.volume24h / 1e9).toFixed(2)}B, last_update_ms=${msSinceUpdate}`;
      })
      .join("\n");

    const symbols = ["BTC", "ETH", "SOL", "BNB"];
    const candleData: Record<string, { maxMove: number; stdDev: number; lastTs: number }> = {};
    await Promise.all(
      symbols.map(async (sym) => {
        const candles = await getCandles(sym, "1h", 24);
        if (candles.length < 2) {
          candleData[sym] = { maxMove: 0, stdDev: 0, lastTs: 0 };
          return;
        }
        const moves = candles.slice(1).map((c, i) => Math.abs((c.close - candles[i].close) / candles[i].close) * 100);
        const maxMove = Math.max(...moves);
        const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
        const variance = moves.reduce((s, m) => s + (m - mean) ** 2, 0) / moves.length;
        const stdDev = Math.sqrt(variance);
        const lastTs = candles[candles.length - 1].time;
        candleData[sym] = { maxMove, stdDev, lastTs };
      })
    );

    const candleLines = symbols
      .map((sym) => {
        const d = candleData[sym];
        return `${sym}: max_hourly_move=${d.maxMove.toFixed(3)}%, volatility_1std=${d.stdDev.toFixed(3)}%, last_candle_ts=${d.lastTs}`;
      })
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You are a security and anomaly detection system for a crypto paper trading platform. Analyze deployment state data and return ONLY valid JSON. Current UTC time: ${new Date().toISOString()}.`,
        },
        {
          role: "user",
          content: `Analyze the following platform deployment state for anomalies and return a security assessment.

Price feed health:
${priceLines}

Price volatility (last 24 candles):
${candleLines}

Check for:
1. Stale price feeds (last_update_ms > 60000ms is suspicious)
2. Extreme volatility (max_hourly_move > 5% or stdDev > 2% is suspicious)
3. Unusual 24h price movements (>8% is suspicious)
4. Volume anomalies (very low or very high)

Return this exact JSON (no markdown, no extra text):
{
  "score": <integer 0-100, where 100 = fully healthy, 0 = critical>,
  "findings": ["<finding 1>", "<finding 2>"],
  "summary": "<1 sentence overall assessment>"
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { score?: number; findings?: string[]; summary?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { score: 75, findings: [], summary: "Assessment unavailable." };
    }

    const score = Math.min(100, Math.max(0, Number(parsed.score ?? 75)));
    cachedResult = {
      status: scoreToStatus(score),
      score,
      summary: parsed.summary ?? "Platform operating normally.",
      findings: parsed.findings ?? [],
      checkedAt: new Date().toISOString(),
    };

    logger.info({ status: cachedResult.status, score }, "sentinel scan complete");
  } catch (err) {
    logger.error({ err }, "sentinel scan failed");
    if (!cachedResult) {
      cachedResult = {
        status: "REVIEW",
        score: 50,
        summary: "Security scan unavailable — treating as under review.",
        findings: ["Scan service unreachable"],
        checkedAt: new Date().toISOString(),
      };
    }
  } finally {
    scanInProgress = false;
  }
}

export function startSentinelMonitor(): void {
  runSentinelScan();
  setInterval(runSentinelScan, 5 * 60 * 1000);
  logger.info("sentinel monitor started");
}

router.get("/sentinel/status", (_req, res) => {
  if (!cachedResult) {
    res.json({
      status: "REVIEW" as SentinelStatus,
      score: null,
      summary: "Initial scan in progress…",
      findings: [],
      checkedAt: null,
    });
    return;
  }
  res.json(cachedResult);
});

export default router;
