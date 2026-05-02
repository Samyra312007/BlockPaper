import { Router } from "express";
import { db } from "@workspace/db";
import { accountsTable, ordersTable, holdingsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getPrice, getAllPrices } from "../lib/prices";
import { PlaceOrderBody } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function ensureAccount(userId: string) {
  const existing = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(accountsTable).values({ userId, cashBalance: "10000.00", totalDeposited: "10000.00" });
    return { cashBalance: 10000, totalDeposited: 10000, userId, createdAt: new Date() };
  }
  return { ...existing[0], cashBalance: Number(existing[0].cashBalance), totalDeposited: Number(existing[0].totalDeposited) };
}

router.get("/account", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;
  const account = await ensureAccount(userId);
  res.json(account);
});

router.get("/portfolio", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;

  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId));

  const prices = getAllPrices();
  const priceMap: Record<string, number> = {};
  for (const p of prices) {
    priceMap[p.symbol] = p.price;
  }

  const NAMES: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB" };

  const result = holdings
    .filter((h) => Number(h.quantity) > 0)
    .map((h) => {
      const qty = Number(h.quantity);
      const avgCost = Number(h.averageCost);
      const currentPrice = priceMap[h.symbol] || 0;
      const currentValue = qty * currentPrice;
      const totalCost = qty * avgCost;
      const unrealizedPnl = currentValue - totalCost;
      return {
        symbol: h.symbol,
        name: NAMES[h.symbol] || h.symbol,
        quantity: qty,
        averageCost: avgCost,
        currentPrice,
        currentValue,
        totalCost,
        unrealizedPnl,
        unrealizedPnlPercent: totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0,
      };
    });

  res.json({ holdings: result });
});

router.get("/portfolio/summary", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;

  const account = await ensureAccount(userId);
  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId));

  const prices = getAllPrices();
  const priceMap: Record<string, number> = {};
  const changeMap: Record<string, number> = {};
  for (const p of prices) {
    priceMap[p.symbol] = p.price;
    changeMap[p.symbol] = p.changePercent24h;
  }

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const allocation: Array<{ symbol: string; name: string; percentage: number; value: number }> = [];
  const NAMES: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB" };

  for (const h of holdings) {
    const qty = Number(h.quantity);
    if (qty <= 0) continue;
    const avgCost = Number(h.averageCost);
    const currentPrice = priceMap[h.symbol] || 0;
    const currentValue = qty * currentPrice;
    const cost = qty * avgCost;
    totalInvested += cost;
    totalCurrentValue += currentValue;
    allocation.push({ symbol: h.symbol, name: NAMES[h.symbol] || h.symbol, percentage: 0, value: currentValue });
  }

  const cashBalance = account.cashBalance;
  const totalPortfolioValue = cashBalance + totalCurrentValue;
  const totalUnrealizedPnl = totalCurrentValue - totalInvested;
  const totalUnrealizedPnlPercent = totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;
  const allTimePnl = totalPortfolioValue - account.totalDeposited;
  const allTimePnlPercent = account.totalDeposited > 0 ? (allTimePnl / account.totalDeposited) * 100 : 0;

  // Day P&L: estimated from current holdings' 24h change
  let dayPnl = 0;
  for (const h of holdings) {
    const qty = Number(h.quantity);
    if (qty <= 0) continue;
    const currentPrice = priceMap[h.symbol] || 0;
    const change = changeMap[h.symbol] || 0;
    const previousPrice = currentPrice / (1 + change / 100);
    dayPnl += qty * (currentPrice - previousPrice);
  }
  const dayPnlPercent = totalPortfolioValue > 0 ? (dayPnl / totalPortfolioValue) * 100 : 0;

  // Calculate allocation percentages
  for (const item of allocation) {
    item.percentage = totalPortfolioValue > 0 ? (item.value / totalPortfolioValue) * 100 : 0;
  }

  res.json({
    cashBalance,
    totalPortfolioValue,
    totalInvested,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent,
    allTimePnl,
    allTimePnlPercent,
    dayPnl,
    dayPnlPercent,
    allocation,
  });
});

router.get("/orders", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;
  const limit = Math.min(Number(req.query["limit"]) || 50, 200);
  const symbol = req.query["symbol"] as string | undefined;
  const status = req.query["status"] as string | undefined;

  let query = db.select().from(ordersTable).where(eq(ordersTable.userId, userId)).$dynamic();

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  const filtered = orders.filter((o) => {
    if (symbol && o.symbol !== symbol.toUpperCase()) return false;
    if (status && status !== "all" && o.status !== status) return false;
    return true;
  });

  res.json(
    filtered.map((o) => ({
      ...o,
      quantity: Number(o.quantity),
      price: Number(o.price),
      limitPrice: o.limitPrice ? Number(o.limitPrice) : null,
    }))
  );
});

router.post("/orders", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;

  const parse = PlaceOrderBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid order: " + parse.error.message });
    return;
  }

  const { symbol, side, type, quantity, limitPrice } = parse.data;
  const sym = symbol.toUpperCase();

  const priceData = getPrice(sym);
  if (!priceData) {
    res.status(400).json({ error: "Unknown symbol" });
    return;
  }

  if (quantity <= 0) {
    res.status(400).json({ error: "Quantity must be positive" });
    return;
  }

  const account = await ensureAccount(userId);
  const executionPrice = type === "market" ? priceData.price : (limitPrice ?? priceData.price);
  const orderStatus = type === "market" ? "filled" : "pending";
  const filledAt = type === "market" ? new Date() : null;

  // For market orders, check balance / holdings immediately
  if (type === "market") {
    if (side === "buy") {
      const cost = quantity * executionPrice;
      if (cost > account.cashBalance) {
        res.status(400).json({ error: "Insufficient cash balance" });
        return;
      }

      // Deduct cash
      await db
        .update(accountsTable)
        .set({ cashBalance: String((account.cashBalance - cost).toFixed(8)) })
        .where(eq(accountsTable.userId, userId));

      // Update holdings
      const existingHolding = await db
        .select()
        .from(holdingsTable)
        .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.symbol, sym)))
        .limit(1);

      if (existingHolding.length > 0) {
        const h = existingHolding[0];
        const currentQty = Number(h.quantity);
        const currentCost = Number(h.averageCost);
        const newQty = currentQty + quantity;
        const newAvg = (currentQty * currentCost + quantity * executionPrice) / newQty;
        await db
          .update(holdingsTable)
          .set({ quantity: String(newQty.toFixed(8)), averageCost: String(newAvg.toFixed(8)) })
          .where(eq(holdingsTable.id, h.id));
      } else {
        await db.insert(holdingsTable).values({
          userId,
          symbol: sym,
          quantity: String(quantity.toFixed(8)),
          averageCost: String(executionPrice.toFixed(8)),
        });
      }
    } else {
      // sell
      const existingHolding = await db
        .select()
        .from(holdingsTable)
        .where(and(eq(holdingsTable.userId, userId), eq(holdingsTable.symbol, sym)))
        .limit(1);

      if (existingHolding.length === 0 || Number(existingHolding[0].quantity) < quantity) {
        res.status(400).json({ error: "Insufficient holdings" });
        return;
      }

      const h = existingHolding[0];
      const currentQty = Number(h.quantity);
      const newQty = currentQty - quantity;
      await db
        .update(holdingsTable)
        .set({ quantity: String(newQty.toFixed(8)) })
        .where(eq(holdingsTable.id, h.id));

      const proceeds = quantity * executionPrice;
      await db
        .update(accountsTable)
        .set({ cashBalance: String((account.cashBalance + proceeds).toFixed(8)) })
        .where(eq(accountsTable.userId, userId));
    }
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      symbol: sym,
      side,
      type,
      quantity: String(quantity.toFixed(8)),
      price: String(executionPrice.toFixed(8)),
      limitPrice: limitPrice ? String(limitPrice.toFixed(8)) : null,
      status: orderStatus,
      filledAt,
    })
    .returning();

  res.status(201).json({
    ...order,
    quantity: Number(order.quantity),
    price: Number(order.price),
    limitPrice: order.limitPrice ? Number(order.limitPrice) : null,
  });
});

router.delete("/orders/:id", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;
  const id = Number(req.params["id"]);

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.status !== "pending") {
    res.status(400).json({ error: "Only pending orders can be cancelled" });
    return;
  }

  const [updated] = await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, id)).returning();

  res.json({
    ...updated,
    quantity: Number(updated.quantity),
    price: Number(updated.price),
    limitPrice: updated.limitPrice ? Number(updated.limitPrice) : null,
  });
});

export default router;
