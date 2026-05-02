import { Router } from "express";
import { getFeedItems } from "../lib/feed";
import { getConnectedClientCount } from "../lib/ws-server";

const router = Router();

router.get("/feed", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const filter = (req.query["filter"] as string) || "recent";
  const items = getFeedItems(filter);
  // Active traders: real WS connections + synthetic floor so it's never 0
  const activeTraders = getConnectedClientCount() + 8 + Math.floor(Math.random() * 15);

  res.json({ items, activeTraders });
});

export default router;
