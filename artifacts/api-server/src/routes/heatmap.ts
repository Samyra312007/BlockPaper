import { Router } from "express";
import { db, candlesTable, holdingsTable, accountsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getAllPrices } from "../lib/prices";
import { logger } from "../lib/logger";

const router = Router();

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"] as const;
const NAMES: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB" };

async function getChange7d(symbol: string, currentPrice: number): Promise<number> {
  try {
    const rows = await db
      .select()
      .from(candlesTable)
      .where(and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, "1d")))
      .orderBy(desc(candlesTable.time))
      .limit(9);

    // rows are desc order — index 7 is ~7 days ago, index 8 is 8 days ago
    const oldest = rows[7] ?? rows.at(-1);
    if (!oldest) return 0;
    const price7d = Number(oldest.close);
    return price7d > 0 ? ((currentPrice - price7d) / price7d) * 100 : 0;
  } catch {
    return 0;
  }
}

router.get("/heatmap", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = (req.user as any).id as string;

  try {
    const prices = getAllPrices();

    // Get holdings and account in parallel alongside 7d candle fetches
    const [holdingsRows, accountRows] = await Promise.all([
      db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
      db.select().from(accountsTable).where(eq(accountsTable.userId, userId)).limit(1),
    ]);

    const cashBalance = accountRows[0] ? Number(accountRows[0].cashBalance) : 10_000;

    const holdingMap: Record<string, { quantity: number; averageCost: number }> = {};
    let totalHoldingsValue = 0;
    for (const h of holdingsRows) {
      const qty = Number(h.quantity);
      if (qty <= 0) continue;
      const priceNow = prices.find((p) => p.symbol === h.symbol)?.price ?? 0;
      holdingMap[h.symbol] = { quantity: qty, averageCost: Number(h.averageCost) };
      totalHoldingsValue += qty * priceNow;
    }
    const totalPortfolioValue = cashBalance + totalHoldingsValue;

    // Fetch 7d changes in parallel
    const change7dEntries = await Promise.all(
      SYMBOLS.map(async (s) => {
        const price = prices.find((p) => p.symbol === s)?.price ?? 0;
        return [s, await getChange7d(s, price)] as const;
      })
    );
    const change7dMap = Object.fromEntries(change7dEntries);

    const tiles = SYMBOLS.map((symbol) => {
      const price = prices.find((p) => p.symbol === symbol);
      const holding = holdingMap[symbol];
      const currentPrice = price?.price ?? 0;
      const quantity = holding?.quantity ?? 0;
      const averageCost = holding?.averageCost ?? 0;
      const holdingValue = quantity * currentPrice;
      const totalCost = quantity * averageCost;
      const unrealizedPnl = holdingValue - totalCost;
      const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
      const allocation = totalPortfolioValue > 0 ? (holdingValue / totalPortfolioValue) * 100 : 0;

      return {
        symbol,
        name: NAMES[symbol] ?? symbol,
        price: currentPrice,
        high24h: price?.high24h ?? 0,
        low24h: price?.low24h ?? 0,
        volume24h: price?.volume24h ?? 0,
        change24h: price?.changePercent24h ?? 0,
        change7d: change7dMap[symbol] ?? 0,
        allocation,
        holdingValue,
        quantity,
        averageCost,
        unrealizedPnl,
        unrealizedPnlPct,
      };
    });

    res.json(tiles);
  } catch (err) {
    logger.error({ err }, "heatmap failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
