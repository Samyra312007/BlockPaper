import { Router } from "express";
import { db, priceAlertsTable, alertTriggersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const MAX_ALERTS = 10;
const VALID_SYMBOLS = new Set(["BTC", "ETH", "SOL", "BNB"]);
const VALID_CONDITIONS = new Set(["above", "below"]);

function auth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function serializeAlert(a: typeof priceAlertsTable.$inferSelect) {
  return { ...a, targetPrice: Number(a.targetPrice) };
}

function serializeTrigger(t: typeof alertTriggersTable.$inferSelect) {
  return { ...t, targetPrice: Number(t.targetPrice), triggeredPrice: Number(t.triggeredPrice) };
}

// ─── Active alerts ────────────────────────────────────────────────────────────

router.get("/alerts", async (req, res) => {
  if (!auth(req, res)) return;
  const userId = req.user!.id;
  const alerts = await db
    .select()
    .from(priceAlertsTable)
    .where(and(eq(priceAlertsTable.userId, userId), eq(priceAlertsTable.active, true)))
    .orderBy(desc(priceAlertsTable.createdAt));
  res.json(alerts.map(serializeAlert));
});

router.post("/alerts", async (req, res) => {
  if (!auth(req, res)) return;
  const userId = req.user!.id;

  const { symbol, condition, targetPrice, recurring } = req.body as Record<string, unknown>;
  if (typeof symbol !== "string" || !VALID_SYMBOLS.has(symbol)) {
    res.status(400).json({ error: "Invalid symbol" }); return;
  }
  if (typeof condition !== "string" || !VALID_CONDITIONS.has(condition)) {
    res.status(400).json({ error: "Invalid condition" }); return;
  }
  const price = Number(targetPrice);
  if (!Number.isFinite(price) || price <= 0) {
    res.status(400).json({ error: "Invalid target price" }); return;
  }

  const existing = await db
    .select({ id: priceAlertsTable.id })
    .from(priceAlertsTable)
    .where(and(eq(priceAlertsTable.userId, userId), eq(priceAlertsTable.active, true)));

  if (existing.length >= MAX_ALERTS) {
    res.status(400).json({ error: `Maximum ${MAX_ALERTS} active alerts per user` }); return;
  }

  const [created] = await db
    .insert(priceAlertsTable)
    .values({ userId, symbol, condition, targetPrice: price.toString(), recurring: Boolean(recurring) })
    .returning();

  res.status(201).json(serializeAlert(created!));
});

router.delete("/alerts/:id", async (req, res) => {
  if (!auth(req, res)) return;
  const userId = req.user!.id;
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(priceAlertsTable)
    .set({ active: false })
    .where(and(eq(priceAlertsTable.id, id), eq(priceAlertsTable.userId, userId)));

  res.json({ ok: true });
});

// ─── Trigger history & pending ────────────────────────────────────────────────

router.get("/alerts/history", async (req, res) => {
  if (!auth(req, res)) return;
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(alertTriggersTable)
    .where(eq(alertTriggersTable.userId, userId))
    .orderBy(desc(alertTriggersTable.triggeredAt))
    .limit(50);
  res.json(rows.map(serializeTrigger));
});

router.get("/alerts/pending", async (req, res) => {
  if (!auth(req, res)) return;
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(alertTriggersTable)
    .where(and(eq(alertTriggersTable.userId, userId), eq(alertTriggersTable.acknowledged, false)))
    .orderBy(desc(alertTriggersTable.triggeredAt))
    .limit(20);
  res.json(rows.map(serializeTrigger));
});

router.post("/alerts/acknowledge", async (req, res) => {
  if (!auth(req, res)) return;
  const userId = req.user!.id;
  await db
    .update(alertTriggersTable)
    .set({ acknowledged: true })
    .where(and(eq(alertTriggersTable.userId, userId), eq(alertTriggersTable.acknowledged, false)));
  res.json({ ok: true });
});

export default router;
