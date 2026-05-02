import { db, priceAlertsTable, alertTriggersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAllPrices } from "./prices";
import { logger } from "./logger";

// Recurring alerts: don't re-fire within 5 minutes of last trigger
const RECURRING_COOLDOWN_MS = 5 * 60 * 1000;
const cooldowns = new Map<number, number>(); // alertId → lastTriggerMs

async function checkAlerts(): Promise<void> {
  try {
    const active = await db
      .select()
      .from(priceAlertsTable)
      .where(eq(priceAlertsTable.active, true));

    if (active.length === 0) return;

    const priceMap: Record<string, number> = {};
    for (const p of getAllPrices()) priceMap[p.symbol] = p.price;

    for (const alert of active) {
      const current = priceMap[alert.symbol];
      if (current === undefined) continue;

      const target = Number(alert.targetPrice);
      const fired = alert.condition === "above" ? current >= target : current <= target;
      if (!fired) continue;

      // Cooldown check for recurring alerts
      if (alert.recurring) {
        const last = cooldowns.get(alert.id);
        if (last && Date.now() - last < RECURRING_COOLDOWN_MS) continue;
        cooldowns.set(alert.id, Date.now());
      }

      // Record the trigger
      await db.insert(alertTriggersTable).values({
        alertId: alert.id,
        userId: alert.userId,
        symbol: alert.symbol,
        condition: alert.condition,
        targetPrice: alert.targetPrice,
        triggeredPrice: current.toFixed(8),
      });

      // One-time alerts deactivate after firing
      if (!alert.recurring) {
        await db
          .update(priceAlertsTable)
          .set({ active: false })
          .where(eq(priceAlertsTable.id, alert.id));
      }

      logger.info(
        { alertId: alert.id, symbol: alert.symbol, condition: alert.condition, target, current },
        "price alert triggered",
      );
    }
  } catch (err) {
    logger.warn({ err }, "alert monitor check failed");
  }
}

export function startAlertMonitor(): void {
  setInterval(() => { checkAlerts().catch(() => {}); }, 10_000);
  logger.info("alert monitor started");
}
