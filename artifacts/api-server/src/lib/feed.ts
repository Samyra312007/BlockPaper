import { db, ordersTable, alertTriggersTable } from "@workspace/db";
import { eq, gte, desc } from "drizzle-orm";
import { getAllPrices } from "./prices";
import { broadcastFeedUpdate } from "./ws-server";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  type: "trade" | "aggregate" | "winner" | "alert";
  symbol: string;
  side?: "buy" | "sell";
  userHash: string;
  message: string;
  detail?: string;
  count?: number;
  profitPct?: number;
  ts: string;
  tags: string[]; // "recent" | "hot" | "winners"
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const MAX_STORE = 120;
let feedStore: FeedItem[] = [];

export function getFeedItems(filter: string): FeedItem[] {
  const tag = filter === "hot" ? "hot" : filter === "winners" ? "winners" : "recent";
  const items = tag === "recent"
    ? feedStore.slice()
    : feedStore.filter((i) => i.tags.includes(tag));
  return items.slice(0, 60);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashUser(userId: string): string {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = Math.imul((h << 5) + h, 1) ^ userId.charCodeAt(i);
    h = h >>> 0;
  }
  return String(1000 + (h % 9000));
}

function mkRng(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function fmtPrice(n: number): string {
  return n >= 1000
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function relTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

const BUY_VERBS = ["accumulated", "went long on", "picked up", "bought into", "added to"];
const SELL_VERBS = ["exited", "sold", "took profit on", "closed position in", "reduced"];
const WIN_VERBS = ["locked in", "reaped", "closed for", "took home"];

// ─── Real DB items ────────────────────────────────────────────────────────────

async function realItemsFromDB(since: Date): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  // Recent filled orders
  const orders = await db
    .select()
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, since))
    .orderBy(desc(ordersTable.createdAt))
    .limit(30);

  for (const order of orders) {
    if (order.status !== "filled") continue;
    const hash = hashUser(order.userId);
    const verb = order.side === "buy" ? "bought" : "sold";
    const tags: string[] = ["recent"];
    if (order.side === "buy") tags.push("hot");

    items.push({
      id: `order-${order.id}`,
      type: "trade",
      symbol: order.symbol,
      side: order.side as "buy" | "sell",
      userHash: hash,
      message: `User #${hash} ${verb} ${order.symbol}`,
      detail: order.side === "buy" ? "Went long" : "Closed position",
      ts: (order.filledAt ?? order.createdAt).toISOString(),
      tags,
    });
  }

  // Aggregate real orders: group by symbol+side in last 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentOrders = orders.filter(
    (o) => o.status === "filled" && new Date(o.createdAt) >= fiveMinAgo,
  );
  const groups: Record<string, number> = {};
  for (const o of recentOrders) {
    const key = `${o.symbol}-${o.side}`;
    groups[key] = (groups[key] ?? 0) + 1;
  }
  for (const [key, count] of Object.entries(groups)) {
    if (count < 2) continue;
    const [symbol, side] = key.split("-");
    const action = side === "buy" ? "bought" : "sold";
    items.push({
      id: `agg-${key}-${fiveMinAgo.getTime()}`,
      type: "aggregate",
      symbol: symbol!,
      side: side as "buy" | "sell",
      userHash: "crowd",
      message: `🔥 ${count} traders ${action} ${symbol} in the last 5 min`,
      count,
      ts: new Date().toISOString(),
      tags: ["recent", "hot"],
    });
  }

  // Recent alert triggers
  const alerts = await db
    .select()
    .from(alertTriggersTable)
    .where(gte(alertTriggersTable.triggeredAt, since))
    .orderBy(desc(alertTriggersTable.triggeredAt))
    .limit(10);

  for (const a of alerts) {
    const hash = hashUser(a.userId);
    const dir = a.condition === "above" ? "↑" : "↓";
    items.push({
      id: `alert-${a.id}`,
      type: "alert",
      symbol: a.symbol,
      userHash: hash,
      message: `User #${hash} — ${a.symbol} alert triggered`,
      detail: `${dir} crossed $${fmtPrice(Number(a.targetPrice))}`,
      ts: a.triggeredAt.toISOString(),
      tags: ["recent"],
    });
  }

  return items;
}

// ─── Synthetic crowd items ────────────────────────────────────────────────────

function generateSyntheticItems(windowKey: number): FeedItem[] {
  const rng = mkRng(windowKey);
  const prices = getAllPrices();
  const items: FeedItem[] = [];
  const now = new Date();

  // Compute symbol weights based on price momentum
  const weights = prices.map((p) => ({
    symbol: p.symbol,
    price: p.price,
    change: p.changePercent24h,
    buyWeight: Math.max(0.1, 1 + p.changePercent24h / 5),   // up → more buyers
    sellWeight: Math.max(0.1, 1 - p.changePercent24h / 10), // down → more sellers
  }));

  function pickSymbolBias(favorBuy: boolean): typeof weights[0] {
    const pool = weights.map((w) => ({ ...w, w: favorBuy ? w.buyWeight : w.sellWeight }));
    const total = pool.reduce((s, w) => s + w.w, 0);
    let r = rng() * total;
    for (const entry of pool) { r -= entry.w; if (r <= 0) return entry; }
    return pool[pool.length - 1]!;
  }

  // 2-3 individual synthetic trades
  const numTrades = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < numTrades; i++) {
    const isBuy = rng() > 0.35; // more buys than sells
    const asset = pickSymbolBias(isBuy);
    const hash = String(1000 + Math.floor(rng() * 9000));
    const verb = isBuy ? pick(rng, BUY_VERBS) : pick(rng, SELL_VERBS);
    const minutesAgo = Math.floor(rng() * 8);
    const ts = new Date(now.getTime() - minutesAgo * 60_000 - Math.floor(rng() * 55_000));
    const tags: string[] = ["recent"];
    if (isBuy) tags.push("hot");
    items.push({
      id: `syn-trade-${windowKey}-${i}`,
      type: "trade",
      symbol: asset.symbol,
      side: isBuy ? "buy" : "sell",
      userHash: hash,
      message: `User #${hash} ${verb} ${asset.symbol}`,
      detail: isBuy ? "Went long" : "Reduced exposure",
      ts: ts.toISOString(),
      tags,
    });
  }

  // 1 aggregate item for the most active symbol
  const hotAsset = [...weights].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0]!;
  const hotCount = 5 + Math.floor(rng() * 20);
  const hotSide = hotAsset.change >= 0 ? "bought" : "sold";
  const hotTs = new Date(now.getTime() - Math.floor(rng() * 3 * 60_000));
  items.push({
    id: `syn-agg-${windowKey}`,
    type: "aggregate",
    symbol: hotAsset.symbol,
    side: hotAsset.change >= 0 ? "buy" : "sell",
    userHash: "crowd",
    message: `🔥 ${hotCount} traders ${hotSide} ${hotAsset.symbol} in the last 5 min`,
    count: hotCount,
    ts: hotTs.toISOString(),
    tags: ["recent", "hot"],
  });

  // 1 winner item (biased toward rising assets)
  const winnerAsset = pickSymbolBias(true);
  const winHash = String(1000 + Math.floor(rng() * 9000));
  const winPct = +(5 + rng() * 20).toFixed(1);
  const winVerb = pick(rng, WIN_VERBS);
  const winTs = new Date(now.getTime() - Math.floor(rng() * 12 * 60_000));
  items.push({
    id: `syn-winner-${windowKey}`,
    type: "winner",
    symbol: winnerAsset.symbol,
    side: "sell",
    userHash: winHash,
    message: `User #${winHash} ${winVerb} +${winPct}% from ${winnerAsset.symbol}`,
    detail: `🏆 +${winPct}% return`,
    profitPct: winPct,
    ts: winTs.toISOString(),
    tags: ["recent", "winners"],
  });

  // Extra winner if market is bullish overall
  const avgChange = prices.reduce((s, p) => s + p.changePercent24h, 0) / prices.length;
  if (avgChange > 1.5 && rng() > 0.4) {
    const asset2 = pickSymbolBias(true);
    const hash2 = String(1000 + Math.floor(rng() * 9000));
    const pct2 = +(8 + rng() * 15).toFixed(1);
    const ts2 = new Date(now.getTime() - Math.floor(rng() * 25 * 60_000));
    items.push({
      id: `syn-winner2-${windowKey}`,
      type: "winner",
      symbol: asset2.symbol,
      side: "sell",
      userHash: hash2,
      message: `User #${hash2} sold ${asset2.symbol} for +${pct2}% profit`,
      detail: `🏆 +${pct2}% realized`,
      profitPct: pct2,
      ts: ts2.toISOString(),
      tags: ["recent", "winners"],
    });
  }

  return items;
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

let lastRealFetch = 0;

async function tick(): Promise<void> {
  try {
    const windowKey = Math.floor(Date.now() / 15_000);
    const synth = generateSyntheticItems(windowKey);

    // Fetch real DB items every 30s to avoid hammering
    let real: FeedItem[] = [];
    if (Date.now() - lastRealFetch > 30_000) {
      const since = new Date(Date.now() - 60 * 60 * 1000); // last 1 hour
      real = await realItemsFromDB(since);
      lastRealFetch = Date.now();
    }

    const existingIds = new Set(feedStore.map((i) => i.id));
    const fresh = [...real, ...synth].filter((i) => !existingIds.has(i.id));

    if (fresh.length === 0) return;

    // Sort fresh items newest first
    fresh.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    feedStore = [...fresh, ...feedStore].slice(0, MAX_STORE);

    broadcastFeedUpdate(fresh);
  } catch (err) {
    logger.warn({ err }, "feed tick failed");
  }
}

export function startFeedBroadcaster(): void {
  // Seed initial store immediately
  const windowKey = Math.floor(Date.now() / 15_000);
  feedStore = generateSyntheticItems(windowKey - 4)
    .concat(generateSyntheticItems(windowKey - 3))
    .concat(generateSyntheticItems(windowKey - 2))
    .concat(generateSyntheticItems(windowKey - 1))
    .concat(generateSyntheticItems(windowKey))
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, MAX_STORE);

  setInterval(() => { tick().catch(() => {}); }, 15_000);
  logger.info("feed broadcaster started");
}
