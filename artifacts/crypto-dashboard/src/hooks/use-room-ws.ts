import { useEffect, useRef, useState, useCallback } from "react";

export interface MemberInfo {
  userId: string;
  username: string;
  color: string;
  watchingSymbol: string;
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

export interface LeaderboardEntry {
  userId: string;
  username: string;
  color: string;
  currentValue: number;
  startValue: number;
  growthPct: number;
}

export interface CursorState {
  userId: string;
  username: string;
  color: string;
  x: number;
  y: number;
  symbol: string;
}

export type RoomConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface RoomState {
  status: RoomConnectionStatus;
  roomCode: string | null;
  roomName: string | null;
  members: MemberInfo[];
  cursors: Record<string, CursorState>;
  trades: TradeEvent[];
  messages: ChatMessage[];
  leaderboard: LeaderboardEntry[];
  sendChat: (text: string) => void;
  sendCursor: (x: number, y: number) => void;
  sendWatching: (symbol: string) => void;
}

type ServerMessage =
  | { type: "room_state"; code: string; name: string; members: MemberInfo[]; trades: TradeEvent[]; messages: ChatMessage[] }
  | { type: "cursor_update"; userId: string; username: string; color: string; x: number; y: number; symbol: string }
  | { type: "cursor_remove"; userId: string }
  | { type: "trade_event"; trade: TradeEvent }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "member_joined"; member: MemberInfo }
  | { type: "member_left"; userId: string; username: string }
  | { type: "leaderboard"; entries: LeaderboardEntry[] }
  | { type: "pong" }
  | { type: "error"; message: string };

export function useRoomWs(roomCode: string | null): RoomState {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCount = useRef(0);

  const [status, setStatus] = useState<RoomConnectionStatus>("disconnected");
  const [roomName, setRoomName] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorState>>({});
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendChat = useCallback((text: string) => send({ type: "chat", text }), [send]);
  const sendCursor = useCallback((x: number, y: number) => send({ type: "cursor", x, y }), [send]);
  const sendWatching = useCallback((symbol: string) => send({ type: "watching", symbol }), [send]);

  useEffect(() => {
    if (!roomCode) return;

    function connect() {
      const loc = window.location;
      const proto = loc.protocol === "https:" ? "wss:" : "ws:";
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const url = `${proto}//${loc.host}${base}/api/ws?room=${roomCode}`;

      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectCount.current = 0;
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      };

      ws.onmessage = (evt) => {
        let msg: ServerMessage;
        try { msg = JSON.parse(evt.data); } catch { return; }

        switch (msg.type) {
          case "room_state":
            setRoomName(msg.name);
            setMembers(msg.members);
            setTrades(msg.trades);
            setMessages(msg.messages);
            break;
          case "cursor_update":
            setCursors((prev) => ({
              ...prev,
              [msg.userId]: { userId: msg.userId, username: msg.username, color: msg.color, x: msg.x, y: msg.y, symbol: msg.symbol },
            }));
            break;
          case "cursor_remove":
            setCursors((prev) => { const n = { ...prev }; delete n[msg.userId]; return n; });
            break;
          case "trade_event":
            setTrades((prev) => [msg.trade, ...prev].slice(0, 50));
            break;
          case "chat_message":
            setMessages((prev) => [...prev, msg.message].slice(-200));
            break;
          case "member_joined":
            setMembers((prev) => [...prev.filter((m) => m.userId !== msg.member.userId), msg.member]);
            break;
          case "member_left":
            setMembers((prev) => prev.filter((m) => m.userId !== msg.userId));
            setCursors((prev) => { const n = { ...prev }; delete n[msg.userId]; return n; });
            break;
          case "leaderboard":
            setLeaderboard(msg.entries);
            break;
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        if (pingRef.current) clearInterval(pingRef.current);
        const delay = Math.min(1000 * 2 ** reconnectCount.current, 30_000);
        reconnectCount.current++;
        reconnectRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => setStatus("error");
    }

    connect();

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectCount.current = 99;
      wsRef.current?.close();
    };
  }, [roomCode]);

  return {
    status,
    roomCode,
    roomName,
    members,
    cursors,
    trades,
    messages,
    leaderboard,
    sendChat,
    sendCursor,
    sendWatching,
  };
}
