import { boolean, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const walletNoncesTable = pgTable("wallet_nonces", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  nonce: varchar("nonce", { length: 128 }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type WalletNonce = typeof walletNoncesTable.$inferSelect;

export const chainTransactionsTable = pgTable("chain_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  orderId: serial("order_id"),
  txHash: varchar("tx_hash", { length: 66 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  side: varchar("side", { length: 4 }).notNull(),
  quantity: text("quantity").notNull(),
  price: text("price").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  blockNumber: serial("block_number"),
  gasUsed: text("gas_used").notNull().default("21000"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChainTransaction = typeof chainTransactionsTable.$inferSelect;
