import { WebSocketServer } from "ws";
import type { IncomingMessage, Server } from "node:http";
import { getSession } from "./auth";
import type { Room } from "./rooms";
import {
  getRoom,
  joinRoom,
  leaveRoom,
  broadcastToRoom,
  sendToMember,
  getMemberInfo,
  getUserPortfolioValue,
  getAllRooms,
} from "./rooms";
import { logger } from "./logger";

type ClientMessage =
  | { type: "join"; roomCode: string }
  | { type: "cursor"; x: number; y: number }
  | { type: "watching"; symbol: string }
  | { type: "chat"; text: string }
  | { type: "ping" };

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

export function startWsServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const urlStr = req.url ?? "/";
    const url = new URL(urlStr, `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== "/api/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws, req: IncomingMessage) => {
    const cookieHeader = req.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const sid = cookies["sid"];

    if (!sid) { ws.close(1008, "Unauthorized"); return; }
    const session = await getSession(sid);
    if (!session?.user?.id) { ws.close(1008, "Unauthorized"); return; }

    const user = session.user;
    const username =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email ||
      "Trader";

    let currentRoomCode: string | null = null;

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const roomParam = url.searchParams.get("room")?.toUpperCase();

    async function doJoin(code: string) {
      const member = await joinRoom(code, user.id, username, ws);
      if (!member) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }
      currentRoomCode = code;
      const room = getRoom(code)!;
      sendToMember(member, {
        type: "room_state",
        code: room.code,
        name: room.name,
        members: [...room.members.values()].map(getMemberInfo),
        trades: room.trades.slice(0, 20),
        messages: room.messages.slice(-50),
      });
      broadcastToRoom(room, { type: "member_joined", member: getMemberInfo(member) }, user.id);

      // Send initial leaderboard
      const entries = await buildLeaderboard(room);
      sendToMember(member, { type: "leaderboard", entries });
    }

    if (roomParam) await doJoin(roomParam);

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (msg.type === "join") {
        await doJoin(msg.roomCode.toUpperCase());
        return;
      }

      if (!currentRoomCode) return;
      const room = getRoom(currentRoomCode);
      if (!room) return;
      const member = room.members.get(user.id);
      if (!member) return;

      if (msg.type === "cursor") {
        const { x, y } = msg;
        if (typeof x !== "number" || typeof y !== "number") return;
        member.cursor = { x, y };
        broadcastToRoom(room, {
          type: "cursor_update",
          userId: user.id,
          username: member.username,
          color: member.color,
          x, y,
          symbol: member.watchingSymbol,
        }, user.id);
        return;
      }

      if (msg.type === "watching") {
        if (!msg.symbol) return;
        member.watchingSymbol = msg.symbol;
        broadcastToRoom(room, {
          type: "cursor_update",
          userId: user.id,
          username: member.username,
          color: member.color,
          x: member.cursor?.x ?? 0.5,
          y: member.cursor?.y ?? 0.5,
          symbol: msg.symbol,
        }, user.id);
        return;
      }

      if (msg.type === "chat") {
        const text = (msg.text ?? "").trim().slice(0, 500);
        if (!text) return;
        const message = {
          id: `${Date.now()}-${user.id}`,
          userId: user.id,
          username: member.username,
          color: member.color,
          text,
          ts: new Date().toISOString(),
        };
        room.messages.push(message);
        if (room.messages.length > 200) room.messages.shift();
        broadcastToRoom(room, { type: "chat_message", message });
        return;
      }
    });

    ws.on("close", () => {
      if (!currentRoomCode) return;
      const result = leaveRoom(user.id);
      const room = getRoom(currentRoomCode);
      if (room && result) {
        broadcastToRoom(room, { type: "cursor_remove", userId: user.id });
        broadcastToRoom(room, { type: "member_left", userId: user.id, username: result.username });
      }
    });

    ws.on("error", (err) => logger.error({ err, userId: user.id }, "ws connection error"));
  });

  // Push leaderboard updates every 15 seconds
  setInterval(async () => {
    for (const room of getAllRooms()) {
      if (room.members.size === 0) continue;
      const entries = await buildLeaderboard(room);
      broadcastToRoom(room, { type: "leaderboard", entries });
    }
  }, 15_000);

  logger.info("WebSocket server started");
}

async function buildLeaderboard(room: Room) {
  const entries = await Promise.all(
    [...room.members.values()].map(async (member) => {
      const currentValue = await getUserPortfolioValue(member.userId);
      const startValue = member.portfolioValueAtJoin;
      const growthPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;
      return { userId: member.userId, username: member.username, color: member.color, currentValue, startValue, growthPct };
    }),
  );
  return entries.sort((a, b) => b.growthPct - a.growthPct);
}
