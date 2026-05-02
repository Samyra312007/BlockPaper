import { numeric, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  userId: varchar("user_id").primaryKey(),
  cashBalance: numeric("cash_balance", { precision: 20, scale: 8 }).notNull().default("10000.00"),
  totalDeposited: numeric("total_deposited", { precision: 20, scale: 8 }).notNull().default("10000.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Account = typeof accountsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  side: varchar("side", { length: 4 }).notNull(), // buy | sell
  type: varchar("type", { length: 10 }).notNull(), // market | limit
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(), // execution price
  limitPrice: numeric("limit_price", { precision: 20, scale: 8 }),
  status: varchar("status", { length: 10 }).notNull().default("pending"), // pending | filled | cancelled
  filledAt: timestamp("filled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;

export const holdingsTable = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull().default("0"),
  averageCost: numeric("average_cost", { precision: 20, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Holding = typeof holdingsTable.$inferSelect;
export type InsertHolding = typeof holdingsTable.$inferInsert;

// Candlestick history (pre-generated for chart display)
export const candlesTable = pgTable("candles", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  interval: varchar("interval", { length: 5 }).notNull(),
  time: numeric("time", { precision: 20, scale: 0 }).notNull(), // unix timestamp seconds
  open: numeric("open", { precision: 20, scale: 8 }).notNull(),
  high: numeric("high", { precision: 20, scale: 8 }).notNull(),
  low: numeric("low", { precision: 20, scale: 8 }).notNull(),
  close: numeric("close", { precision: 20, scale: 8 }).notNull(),
  volume: numeric("volume", { precision: 20, scale: 8 }).notNull(),
});

export type Candle = typeof candlesTable.$inferSelect;

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrderInput = z.infer<typeof insertOrderSchema>;
