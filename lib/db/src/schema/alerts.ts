import { boolean, integer, numeric, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const priceAlertsTable = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  condition: varchar("condition", { length: 5 }).notNull(), // "above" | "below"
  targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
  recurring: boolean("recurring").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PriceAlert = typeof priceAlertsTable.$inferSelect;
export type InsertPriceAlert = typeof priceAlertsTable.$inferInsert;

export const alertTriggersTable = pgTable("alert_triggers", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull(),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  condition: varchar("condition", { length: 5 }).notNull(),
  targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
  triggeredPrice: numeric("triggered_price", { precision: 20, scale: 8 }).notNull(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledged: boolean("acknowledged").notNull().default(false),
});

export type AlertTrigger = typeof alertTriggersTable.$inferSelect;
