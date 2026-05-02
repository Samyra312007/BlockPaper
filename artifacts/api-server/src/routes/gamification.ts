import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import {
  getQuestsWithProgress,
  getBadges,
  getWeeklyContest,
  enrollInWeeklyContest,
  getUserPortfolioValue,
  getWeekStart,
} from "../lib/gamification";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/gamification/quests", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;
  const portfolioValue = await getUserPortfolioValue(userId);
  const quests = await getQuestsWithProgress(userId, portfolioValue);
  res.json({ quests, portfolioValue });
});

router.get("/gamification/badges", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;
  const badges = await getBadges(userId);
  res.json({ badges });
});

router.get("/gamification/contest", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const userId = req.user!.id;
  const portfolioValue = await getUserPortfolioValue(userId);
  await enrollInWeeklyContest(userId, portfolioValue);
  const leaderboard = await getWeeklyContest();

  const userIds = leaderboard.map(e => e.userId);
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const nameMap = new Map(users.map(u => [
    u.id,
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Trader",
  ]));

  res.json({
    leaderboard: leaderboard.map(e => ({
      ...e,
      displayName: nameMap.get(e.userId) ?? "Trader",
      isMe: e.userId === userId,
    })),
    weekStart: getWeekStart(),
    prizes: [500, 200, 100],
  });
});

export default router;
