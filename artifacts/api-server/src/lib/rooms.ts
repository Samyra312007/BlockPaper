import { db, accountsTable, holdingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAllPrices } from "./prices";
import { logger } from "./logger";
import crypto from "node:crypto";

const CURSOR_COLORS = [
  "#60A5FA", "#F472B6", "#34D399", "#FBBF24",
  "#A78BFA", "#F87171", "#FB923C", "#22D3EE",
];

export interface WsConn {
  send(data: string): void;
  readyState: number;
}

export interface RoomMember {
  userId: string;
  username: string;
  color: string;
  watchingSymbol: string;
  portfolioValueAtJoin: number;
  cursor: { x: number; y: number } | null;
  ws: WsConn;
}

export interface TradeEvent {
  userId: string;
  username: string;
  color: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  ts: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  color: string;
  text: string;
  ts: string;
}

export interface MemberInfo {
  userId: string;
  username: string;
  color: string;
  watchingSymbol: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  color: string;
  currentValue: number;
  startValue: number;
  growthPct: number;
}

export interface Room {
  code: string;
  name: string;
  members: Map<string, RoomMember>;
  trades: TradeEvent[];
  messages: ChatMessage[];
  createdAt: Date;
}

export type ServerMessage =
  | { type: "room_state"; code: string; name: string; members: MemberInfo[]; trades: TradeEvent[]; messages: ChatMessage[] }
  | { type: "cursor_update"; userId: string; username: string; color: string; x: number; y: number; symbol: string }
  | { type: "cursor_remove"; userId: string }
  | { type: "trade_event"; trade: TradeEvent }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "member_joined"; member: MemberInfo }
  | { type: "member_left"; userId: string; username: string }
  | { type: "leaderboard"; entries: LeaderboardEntry[] }
  | { type: "error"; message: string };

const rooms = new Map<string, Room>();
const userRooms = new Map<string, string>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function assignColor(room: Room): string {
  const used = new Set([...room.members.values()].map((m) => m.color));
  return CURSOR_COLORS.find((c) => !used.has(c)) ?? CURSOR_COLORS[room.members.size % CURSOR_COLORS.length];
}

export function createRoom(name: string): Room {
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));
  const room: Room = { code, name, members: new Map(), trades: [], messages: [], createdAt: new Date() };
  rooms.set(code, room);
  logger.info({ code, name }, "room created");
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getAllRooms(): Room[] {
  return [...rooms.values()];
}

export async function getUserPortfolioValue(userId: string): Promise<number> {
  try {
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId)).limit(1);
    const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId));
    const prices = getAllPrices();
    const priceMap: Record<string, number> = {};
    for (const p of prices) priceMap[p.symbol] = p.price;
    const cash = account ? Number(account.cashBalance) : 10000;
    const holdingValue = holdings.reduce((sum, h) => sum + Number(h.quantity) * (priceMap[h.symbol] ?? 0), 0);
    return cash + holdingValue;
  } catch {
    return 10000;
  }
}

export async function joinRoom(
  code: string,
  userId: string,
  username: string,
  ws: WsConn,
): Promise<RoomMember | null> {
  const room = getRoom(code);
  if (!room) return null;
  leaveRoom(userId);

  const portfolioValue = await getUserPortfolioValue(userId);
  const color = assignColor(room);

  const member: RoomMember = {
    userId, username, color,
    watchingSymbol: "BTC",
    portfolioValueAtJoin: portfolioValue,
    cursor: null,
    ws,
  };

  room.members.set(userId, member);
  userRooms.set(userId, code);
  logger.info({ code, userId, username }, "member joined room");
  return member;
}

export function leaveRoom(userId: string): { code: string; username: string } | null {
  const code = userRooms.get(userId);
  if (!code) return null;
  const room = rooms.get(code);
  const username = room?.members.get(userId)?.username ?? "Unknown";
  if (room) {
    room.members.delete(userId);
    if (room.members.size === 0) {
      setTimeout(() => {
        if (rooms.get(code)?.members.size === 0) {
          rooms.delete(code);
          logger.info({ code }, "empty room deleted");
        }
      }, 5 * 60 * 1000);
    }
  }
  userRooms.delete(userId);
  return { code, username };
}

export function broadcastToRoom(room: Room, msg: ServerMessage, excludeUserId?: string): void {
  const payload = JSON.stringify(msg);
  for (const [uid, member] of room.members) {
    if (uid === excludeUserId) continue;
    if (member.ws.readyState === 1) member.ws.send(payload);
  }
}

export function sendToMember(member: RoomMember, msg: ServerMessage): void {
  if (member.ws.readyState === 1) member.ws.send(JSON.stringify(msg));
}

export function getMemberInfo(member: RoomMember): MemberInfo {
  return { userId: member.userId, username: member.username, color: member.color, watchingSymbol: member.watchingSymbol };
}

export function notifyRoomTrade(
  userId: string,
  username: string,
  symbol: string,
  side: "buy" | "sell",
  quantity: number,
  price: number,
): void {
  const code = userRooms.get(userId);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  const color = room.members.get(userId)?.color ?? "#60A5FA";
  const event: TradeEvent = {
    userId, username, color, symbol, side, quantity, price,
    ts: new Date().toISOString(),
  };
  room.trades.unshift(event);
  if (room.trades.length > 50) room.trades.pop();
  broadcastToRoom(room, { type: "trade_event", trade: event });
}
