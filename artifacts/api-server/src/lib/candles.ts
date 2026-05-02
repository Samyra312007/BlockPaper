import { db } from "@workspace/db";
import { candlesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getPrice } from "./prices";
import { logger } from "./logger";

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"];
const INTERVAL = "1h";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Generate historical candles seeded data
export async function seedCandles() {
  // Check if already seeded
  const existing = await db.select().from(candlesTable).limit(1);
  if (existing.length > 0) {
    logger.info("candles already seeded");
    return;
  }

  const BASE_PRICES: Record<string, number> = {
    BTC: 67000, ETH: 3500, SOL: 180, BNB: 560,
  };

  const now = Math.floor(Date.now() / 1000);
  const oneHour = 3600;
  const numCandles = 200;

  const rows: typeof candlesTable.$inferInsert[] = [];

  for (const symbol of SYMBOLS) {
    let price = BASE_PRICES[symbol];
    const baseVolume = symbol === "BTC" ? 1200 : symbol === "ETH" ? 8000 : symbol === "SOL" ? 50000 : 3000;

    for (let i = numCandles; i >= 0; i--) {
      const time = now - i * oneHour;
      const open = price;
      const change = price * 0.015 * (Math.random() * 2 - 1);
      const close = Math.max(price + change, price * 0.001);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      const volume = baseVolume * (0.5 + Math.random());

      rows.push({
        symbol,
        interval: INTERVAL,
        time: String(time),
        open: String(open.toFixed(8)),
        high: String(high.toFixed(8)),
        low: String(low.toFixed(8)),
        close: String(close.toFixed(8)),
        volume: String(volume.toFixed(8)),
      });

      price = close;
    }
  }

  // Insert in batches
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(candlesTable).values(rows.slice(i, i + 100));
  }
  logger.info({ count: rows.length }, "candles seeded");
}

// Append a new candle based on current simulated price
export async function appendCurrentCandle(symbol: string) {
  const priceData = getPrice(symbol);
  if (!priceData) return;

  const now = Math.floor(Date.now() / 1000);
  const hourSlot = Math.floor(now / 3600) * 3600;

  // Upsert-like: get last candle for this hour
  const last = await db
    .select()
    .from(candlesTable)
    .where(and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, INTERVAL), eq(candlesTable.time, String(hourSlot))))
    .limit(1);

  if (last.length > 0) {
    const existing = last[0];
    const newHigh = Math.max(Number(existing.high), priceData.price);
    const newLow = Math.min(Number(existing.low), priceData.price);
    await db
      .update(candlesTable)
      .set({
        high: String(newHigh.toFixed(8)),
        low: String(newLow.toFixed(8)),
        close: String(priceData.price.toFixed(8)),
      })
      .where(eq(candlesTable.id, existing.id));
  } else {
    const baseVolume = symbol === "BTC" ? 1200 : symbol === "ETH" ? 8000 : symbol === "SOL" ? 50000 : 3000;
    await db.insert(candlesTable).values({
      symbol,
      interval: INTERVAL,
      time: String(hourSlot),
      open: String(priceData.price.toFixed(8)),
      high: String(priceData.price.toFixed(8)),
      low: String(priceData.price.toFixed(8)),
      close: String(priceData.price.toFixed(8)),
      volume: String((baseVolume * Math.random()).toFixed(8)),
    });
  }
}

export async function getCandles(symbol: string, interval: string = "1h", limit: number = 100): Promise<CandleData[]> {
  const rows = await db
    .select()
    .from(candlesTable)
    .where(and(eq(candlesTable.symbol, symbol.toUpperCase()), eq(candlesTable.interval, interval)))
    .orderBy(desc(candlesTable.time))
    .limit(limit);

  return rows
    .reverse()
    .map((r) => ({
      time: Number(r.time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }));
}
