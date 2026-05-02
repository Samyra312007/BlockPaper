import { Router } from "express";
import { createRoom, getRoom, getMemberInfo, getUserPortfolioValue } from "../lib/rooms";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.post("/rooms", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const name = (req.body?.name as string | undefined)?.trim().slice(0, 60) || "Trading Room";
  const room = createRoom(name);
  res.status(201).json({ code: room.code, name: room.name, createdAt: room.createdAt });
});

router.get("/rooms/:code", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const room = getRoom(req.params["code"]);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const members = [...room.members.values()].map(getMemberInfo);
  const leaderboard = await Promise.all(
    [...room.members.values()].map(async (m) => {
      const currentValue = await getUserPortfolioValue(m.userId);
      const startValue = m.portfolioValueAtJoin;
      const growthPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;
      return { userId: m.userId, username: m.username, color: m.color, currentValue, startValue, growthPct };
    }),
  );
  leaderboard.sort((a, b) => b.growthPct - a.growthPct);

  res.json({
    code: room.code,
    name: room.name,
    memberCount: room.members.size,
    members,
    leaderboard,
    recentTrades: room.trades.slice(0, 20),
    createdAt: room.createdAt,
  });
});

export default router;
