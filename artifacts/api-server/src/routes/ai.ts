import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getCandles } from "../lib/candles";
import { getAllPrices } from "../lib/prices";
import { SendAiChatMessageBody } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  // signal = 9-period EMA of MACD (approximate with recent data)
  const signal = macd * 0.9;
  return { macd, signal, histogram: macd - signal };
}

async function getIndicators(symbol: string) {
  const candles = await getCandles(symbol, "1h", 60);
  const closes = candles.map((c) => c.close);
  const rsi = calcRSI(closes);
  const { macd, signal, histogram } = calcMACD(closes);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  return { rsi, macd, signal, histogram, sma20, sma50, ema12, ema26 };
}

router.get("/openai/signals", async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const prices = getAllPrices();
    const symbols = ["BTC", "ETH", "SOL", "BNB"];

    const indicatorsMap: Record<string, Awaited<ReturnType<typeof getIndicators>>> = {};
    await Promise.all(
      symbols.map(async (sym) => {
        indicatorsMap[sym] = await getIndicators(sym);
      })
    );

    const priceLines = prices
      .map((p) => {
        const ind = indicatorsMap[p.symbol];
        return `${p.symbol} (${p.name}): price=$${p.price.toFixed(2)}, 24h change=${p.changePercent24h.toFixed(2)}%, RSI=${ind?.rsi.toFixed(1)}, MACD=${ind?.macd.toFixed(2)}, SMA20=$${ind?.sma20.toFixed(2)}, SMA50=$${ind?.sma50.toFixed(2)}`;
      })
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `You are an expert crypto technical analyst for a paper trading platform. Analyze market data and return ONLY valid JSON. Today is ${new Date().toISOString().split("T")[0]}.`,
        },
        {
          role: "user",
          content: `Analyze the following crypto assets and return trading signals as JSON.

Market data:
${priceLines}

Return this exact JSON structure (no markdown, no extra text):
{
  "signals": [
    {
      "symbol": "BTC",
      "signal": "BUY" | "SELL" | "HOLD",
      "confidence": <number 0-100>,
      "reasoning": "<2-3 sentence analysis>",
      "suggestedQuantity": <small number based on $1000 position>,
      "suggestedPrice": <current price>
    }
  ]
}

Include all 4 assets: BTC, ETH, SOL, BNB. Base signals on RSI (oversold <30 bullish, overbought >70 bearish), MACD direction, price vs moving averages, and 24h momentum.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { signals: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { signals: [] };
    }

    const signals = (parsed.signals as any[]).map((s: any) => {
      const ind = indicatorsMap[s.symbol] ?? { rsi: 50, macd: 0, signal: 0, histogram: 0, sma20: 0, sma50: 0, ema12: 0, ema26: 0 };
      return {
        symbol: s.symbol,
        signal: s.signal,
        confidence: Number(s.confidence),
        reasoning: s.reasoning,
        technicals: ind,
        suggestedQuantity: Number(s.suggestedQuantity),
        suggestedPrice: Number(s.suggestedPrice),
      };
    });

    res.json({ signals, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    req.log.error({ err }, "failed to generate signals");
    res.status(500).json({ error: "Failed to generate signals" });
  }
});

router.get("/openai/market-summary", async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const prices = getAllPrices();

    const priceLines = prices
      .map((p) => `${p.symbol}: $${p.price.toFixed(2)} (${p.changePercent24h >= 0 ? "+" : ""}${p.changePercent24h.toFixed(2)}% 24h), Volume: $${(p.volume24h / 1e9).toFixed(1)}B`)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: "You are a crypto market analyst. Return ONLY valid JSON with no markdown.",
        },
        {
          role: "user",
          content: `Write a brief daily market summary for these crypto assets on ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}:

${priceLines}

Return this exact JSON:
{
  "summary": "<2-3 sentence overview of current market conditions>",
  "sentiment": "bullish" | "bearish" | "neutral",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3>"]
}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; sentiment?: string; keyPoints?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: "Market analysis unavailable.", sentiment: "neutral", keyPoints: [] };
    }

    res.json({
      summary: parsed.summary ?? "",
      sentiment: parsed.sentiment ?? "neutral",
      keyPoints: parsed.keyPoints ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "failed to generate market summary");
    res.status(500).json({ error: "Failed to generate market summary" });
  }
});

router.post("/openai/chat", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const parsed = SendAiChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const prices = getAllPrices();
  const priceContext = prices
    .map((p) => `${p.symbol}: $${p.price.toFixed(2)} (${p.changePercent24h >= 0 ? "+" : ""}${p.changePercent24h.toFixed(2)}% 24h)`)
    .join(", ");

  const systemPrompt = `You are an AI trading assistant for CryptoDesk, a paper trading platform. You help users make informed trading decisions in demo mode with $10,000 virtual balance. Be concise, insightful, and always remind users this is paper trading.

Current market prices (simulated): ${priceContext}
Current time: ${new Date().toISOString()}

Provide helpful analysis but always note this is for educational purposes only.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        ...parsed.data.messages.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    req.log.error({ err }, "chat stream failed");
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  }
});

export default router;
