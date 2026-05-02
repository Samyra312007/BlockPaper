import { db, accountsTable, holdingsTable, ordersTable, userBadgesTable, dailyQuestProgressTable, weeklyContestTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { getAllPrices } from "./prices";
import { logger } from "./logger";

export const BADGE_DEFS: Record<string, { id: string; name: string; emoji: string; description: string }> = {
  first_blood:   { id: "first_blood",   name: "First Blood",       emoji: "🩸", description: "Complete your first trade" },
  paper_hands:   { id: "paper_hands",   name: "Paper Hands",       emoji: "📄", description: "Sold within 1 hour of buying" },
  diamond_hands: { id: "diamond_hands", name: "Diamond Hands",     emoji: "💎", description: "Hold a position for 7+ days" },
  hat_trick:     { id: "hat_trick",     name: "Hat Trick",         emoji: "🎯", description: "Trade 3 different assets in one day" },
  bull_run:      { id: "bull_run",      name: "Bull Run",          emoji: "🐂", description: "Achieve 5% portfolio growth in one day" },
  weekly_champ:  { id: "weekly_champ",  name: "Weekly Champion",   emoji: "🏆", description: "Finish #1 in a weekly contest" },
};

export const QUEST_DEFS = [
  { id: "trades_3", name: "Market Maker",  description: "Complete 3 trades today",              target: 3, unit: "trades",  reward: 100, badgeId: null,        rewardField: "rewardTrade3"  as const },
  { id: "return_5", name: "Bull Market",   description: "Achieve 5% portfolio return today",     target: 5, unit: "%",       reward:  50, badgeId: "bull_run",  rewardField: "rewardReturn5" as const },
  { id: "assets_3", name: "Diversifier",   description: "Trade 3 different assets today",        target: 3, unit: "assets",  reward:  50, badgeId: "hat_trick", rewardField: "rewardAssets3" as const },
];

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export async function getUserPortfolioValue(userId: string): Promise<number> {
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId)).limit(1);
  if (!account) return 10000;
  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId));
  const prices = getAllPrices();
  const priceMap: Record<string, number> = {};
  for (const p of prices) priceMap[p.symbol] = p.price;
  let total = Number(account.cashBalance);
  for (const h of holdings) {
    if (Number(h.quantity) > 0) total += Number(h.quantity) * (priceMap[h.symbol] || 0);
  }
  return total;
}

async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
  const existing = await db.select().from(userBadgesTable)
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badgeId))).limit(1);
  if (existing.length > 0) return false;
  try {
    await db.insert(userBadgesTable).values({ userId, badgeId });
    return true;
  } catch {
    return false;
  }
}

async function creditAccount(userId: string, amount: number): Promise<void> {
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId)).limit(1);
  if (!account) return;
  const newBalance = (Number(account.cashBalance) + amount).toFixed(8);
  await db.update(accountsTable).set({ cashBalance: newBalance }).where(eq(accountsTable.userId, userId));
}

export async function getOrCreateDailyProgress(userId: string, portfolioValue: number) {
  const date = getTodayDate();
  const existing = await db.select().from(dailyQuestProgressTable)
    .where(and(eq(dailyQuestProgressTable.userId, userId), eq(dailyQuestProgressTable.date, date))).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(dailyQuestProgressTable).values({
    userId, date, startPortfolioValue: portfolioValue.toFixed(8),
  }).returning();
  return created;
}

export async function onTradeCompleted(
  userId: string,
  symbol: string,
  side: "buy" | "sell",
  filledAt: Date,
  portfolioValue: number,
): Promise<{ newBadges: string[]; questsCompleted: string[]; totalReward: number }> {
  const newBadges: string[] = [];
  const questsCompleted: string[] = [];
  let totalReward = 0;
  const date = getTodayDate();

  const progress = await getOrCreateDailyProgress(userId, portfolioValue);
  const tradesCount = progress.tradesCount + 1;
  const assetsList: string[] = JSON.parse(progress.assetsTraded || "[]");
  if (!assetsList.includes(symbol)) assetsList.push(symbol);

  await db.update(dailyQuestProgressTable)
    .set({ tradesCount, assetsTraded: JSON.stringify(assetsList), updatedAt: new Date() })
    .where(and(eq(dailyQuestProgressTable.userId, userId), eq(dailyQuestProgressTable.date, date)));

  // Quest: 3 trades → +$100
  if (!progress.rewardTrade3 && tradesCount >= 3) {
    await db.update(dailyQuestProgressTable).set({ rewardTrade3: true })
      .where(and(eq(dailyQuestProgressTable.userId, userId), eq(dailyQuestProgressTable.date, date)));
    await creditAccount(userId, 100);
    questsCompleted.push("trades_3");
    totalReward += 100;
  }

  // Quest: 3 different assets → +$50 + hat_trick badge
  if (!progress.rewardAssets3 && assetsList.length >= 3) {
    await db.update(dailyQuestProgressTable).set({ rewardAssets3: true })
      .where(and(eq(dailyQuestProgressTable.userId, userId), eq(dailyQuestProgressTable.date, date)));
    await creditAccount(userId, 50);
    questsCompleted.push("assets_3");
    totalReward += 50;
    if (await awardBadge(userId, "hat_trick")) newBadges.push("hat_trick");
  }

  // Quest: 5% daily return → +$50 + bull_run badge
  const startValue = Number(progress.startPortfolioValue);
  if (!progress.rewardReturn5 && startValue > 0 && portfolioValue >= startValue * 1.05) {
    await db.update(dailyQuestProgressTable).set({ rewardReturn5: true })
      .where(and(eq(dailyQuestProgressTable.userId, userId), eq(dailyQuestProgressTable.date, date)));
    await creditAccount(userId, 50);
    questsCompleted.push("return_5");
    totalReward += 50;
    if (await awardBadge(userId, "bull_run")) newBadges.push("bull_run");
  }

  // Badge: First Blood (first ever filled order)
  const allFilledOrders = await db.select({ id: ordersTable.id }).from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "filled"))).limit(2);
  if (allFilledOrders.length <= 1) {
    if (await awardBadge(userId, "first_blood")) newBadges.push("first_blood");
  }

  // Badge: Paper Hands (sold within 1 hour of buying same symbol)
  if (side === "sell") {
    const oneHourAgo = new Date(filledAt.getTime() - 60 * 60 * 1000);
    const recentBuys = await db.select({ id: ordersTable.id }).from(ordersTable)
      .where(and(
        eq(ordersTable.userId, userId),
        eq(ordersTable.symbol, symbol),
        eq(ordersTable.side, "buy"),
        eq(ordersTable.status, "filled"),
        gte(ordersTable.filledAt, oneHourAgo),
      )).limit(1);
    if (recentBuys.length > 0) {
      if (await awardBadge(userId, "paper_hands")) newBadges.push("paper_hands");
    }
  }

  return { newBadges, questsCompleted, totalReward };
}

export async function checkDiamondHands(userId: string): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId));
  const hasDiamond = holdings.some(h => Number(h.quantity) > 0 && new Date(h.createdAt) <= sevenDaysAgo);
  if (hasDiamond) return awardBadge(userId, "diamond_hands");
  return false;
}

export async function getBadges(userId: string) {
  const earned = await db.select().from(userBadgesTable)
    .where(eq(userBadgesTable.userId, userId)).orderBy(desc(userBadgesTable.earnedAt));
  const earnedMap = new Map(earned.map(b => [b.badgeId, b.earnedAt]));
  return Object.values(BADGE_DEFS).map(badge => ({
    ...badge,
    earned: earnedMap.has(badge.id),
    earnedAt: earnedMap.get(badge.id) ?? null,
  }));
}

export async function getQuestsWithProgress(userId: string, portfolioValue: number) {
  checkDiamondHands(userId).catch(() => {});
  const progress = await getOrCreateDailyProgress(userId, portfolioValue);
  const startValue = Number(progress.startPortfolioValue);
  const assetsTraded: string[] = JSON.parse(progress.assetsTraded || "[]");
  const currentReturnPct = startValue > 0 ? ((portfolioValue - startValue) / startValue) * 100 : 0;

  return QUEST_DEFS.map(q => {
    let current: number;
    let completed: boolean;
    if (q.id === "trades_3") { current = progress.tradesCount; completed = progress.rewardTrade3; }
    else if (q.id === "return_5") { current = Math.max(0, currentReturnPct); completed = progress.rewardReturn5; }
    else { current = assetsTraded.length; completed = progress.rewardAssets3; }
    return { ...q, current: parseFloat(Math.min(current, q.target).toFixed(2)), completed, date: progress.date };
  });
}

export async function enrollInWeeklyContest(userId: string, portfolioValue: number): Promise<void> {
  const weekStart = getWeekStart();
  try {
    await db.insert(weeklyContestTable).values({
      userId, weekStart, startPortfolioValue: portfolioValue.toFixed(8),
    });
  } catch { /* already enrolled */ }
}

export async function getWeeklyContest() {
  const weekStart = getWeekStart();
  const entries = await db.select().from(weeklyContestTable).where(eq(weeklyContestTable.weekStart, weekStart));

  const results = await Promise.all(entries.map(async entry => {
    const currentValue = await getUserPortfolioValue(entry.userId);
    const startValue = Number(entry.startPortfolioValue);
    const growthPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;
    return { userId: entry.userId, weekStart: entry.weekStart, startValue, currentValue, growthPct, prizeAwarded: entry.prizeAwarded, prizeAmount: Number(entry.prizeAmount) };
  }));

  results.sort((a, b) => b.growthPct - a.growthPct);
  return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function processWeeklyPrizes(weekStart: string): Promise<void> {
  const entries = await db.select().from(weeklyContestTable)
    .where(and(eq(weeklyContestTable.weekStart, weekStart), eq(weeklyContestTable.prizeAwarded, false)));
  if (entries.length === 0) return;

  const ranked = await Promise.all(entries.map(async entry => {
    const currentValue = await getUserPortfolioValue(entry.userId);
    const startValue = Number(entry.startPortfolioValue);
    const growthPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;
    return { ...entry, growthPct };
  }));

  ranked.sort((a, b) => b.growthPct - a.growthPct);
  const prizes = [500, 200, 100];

  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    const winner = ranked[i]!;
    const prize = prizes[i]!;
    await creditAccount(winner.userId, prize);
    await db.update(weeklyContestTable)
      .set({ prizeAwarded: true, prizeAmount: prize.toFixed(8), updatedAt: new Date() })
      .where(eq(weeklyContestTable.id, winner.id));
    if (i === 0) await awardBadge(winner.userId, "weekly_champ");
    logger.info({ userId: winner.userId, prize, rank: i + 1 }, "weekly prize awarded");
  }
}

export function startWeeklyMonitor(): void {
  let lastProcessed = "";
  setInterval(async () => {
    const now = new Date();
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 0) return;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - 7);
    const lastWeekStart = lastMonday.toISOString().slice(0, 10);
    if (lastWeekStart === lastProcessed) return;
    lastProcessed = lastWeekStart;
    try {
      await processWeeklyPrizes(lastWeekStart);
      logger.info({ weekStart: lastWeekStart }, "weekly prizes processed");
    } catch (err) {
      logger.error({ err }, "weekly prizes failed");
    }
  }, 60 * 60 * 1000);
}
