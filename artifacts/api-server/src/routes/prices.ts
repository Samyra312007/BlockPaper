import { Router } from "express";
import { getAllPrices, getPrice } from "../lib/prices";
import { getCandles } from "../lib/candles";

const router = Router();

router.get("/prices", (_req, res) => {
  res.json(getAllPrices());
});

router.get("/prices/:symbol/candles", async (req, res) => {
  const { symbol } = req.params;
  const interval = (req.query["interval"] as string) || "1h";
  const limit = Math.min(Number(req.query["limit"]) || 100, 500);

  const price = getPrice(symbol);
  if (!price) {
    res.status(404).json({ error: "Symbol not found" });
    return;
  }

  const candles = await getCandles(symbol, interval, limit);
  res.json(candles);
});

export default router;
