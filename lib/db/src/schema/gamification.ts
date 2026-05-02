import { boolean, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const userBadgesTable = pgTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    badgeId: varchar("badge_id", { length: 50 }).notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_badge_unique").on(t.userId, t.badgeId)],
);

export type UserBadge = typeof userBadgesTable.$inferSelect;

export const dailyQuestProgressTable = pgTable(
  "daily_quest_progress",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD UTC
    tradesCount: integer("trades_count").notNull().default(0),
    assetsTraded: text("assets_traded").notNull().default("[]"), // JSON string: ["BTC","ETH"]
    startPortfolioValue: numeric("start_portfolio_value", { precision: 20, scale: 8 }).notNull().default("0"),
    rewardTrade3: boolean("reward_trade3").notNull().default(false),
    rewardReturn5: boolean("reward_return5").notNull().default(false),
    rewardAssets3: boolean("reward_assets3").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_quest_unique").on(t.userId, t.date)],
);

export type DailyQuestProgress = typeof dailyQuestProgressTable.$inferSelect;

export const weeklyContestTable = pgTable(
  "weekly_contest",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    weekStart: varchar("week_start", { length: 10 }).notNull(), // YYYY-MM-DD of Monday
    startPortfolioValue: numeric("start_portfolio_value", { precision: 20, scale: 8 }).notNull(),
    prizeAwarded: boolean("prize_awarded").notNull().default(false),
    prizeAmount: numeric("prize_amount", { precision: 20, scale: 8 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weekly_contest_unique").on(t.userId, t.weekStart)],
);

export type WeeklyContestEntry = typeof weeklyContestTable.$inferSelect;
