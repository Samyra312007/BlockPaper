import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetPrices, getGetPricesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Chart } from "@/components/terminal/chart";
import { RoomCursors } from "@/components/room/cursors";
import { TradeForm } from "@/components/terminal/trade-form";
import { useRoomWs } from "@/hooks/use-room-ws";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { formatPrice, formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { Copy, Check, Users, Trophy, MessageSquare, ArrowUpRight, ArrowDownRight, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

const ASSETS = ["BTC", "ETH", "SOL", "BNB"];

function StatusDot({ status }: { status: string }) {
  if (status === "connected") return <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />;
  if (status === "connecting") return <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />;
  return <span className="h-2 w-2 rounded-full bg-red-500" />;
}

function WatchersBadge({ cursors, members, symbol }: { cursors: Record<string, any>; members: any[]; symbol: string }) {
  const watching = members.filter((m) => m.watchingSymbol === symbol).length;
  if (watching === 0) return null;
  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
      <Users className="h-3 w-3" />
      {watching} watching {symbol}
    </Badge>
  );
}

function TradeFeed({ trades }: { trades: any[] }) {
  if (trades.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No room trades yet</div>;
  }
  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border/50">
        {trades.slice(0, 30).map((t, i) => (
          <div key={`${t.ts}-${i}`} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/30">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            <span className="text-xs text-muted-foreground shrink-0 w-14 font-mono">{format(new Date(t.ts), "HH:mm:ss")}</span>
            <span className="text-xs font-medium truncate" style={{ color: t.color }}>{t.username.split(" ")[0]}</span>
            <span className={`text-xs font-bold shrink-0 ${t.side === "buy" ? "text-emerald-500" : "text-red-500"}`}>
              {t.side === "buy" ? <ArrowUpRight className="h-3 w-3 inline" /> : <ArrowDownRight className="h-3 w-3 inline" />}
              {t.side.toUpperCase()}
            </span>
            <span className="text-xs font-mono shrink-0">{t.quantity} {t.symbol}</span>
            <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">@{formatPrice(t.price, "USD").replace("$", "")}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function Leaderboard({ entries, currentUserId }: { entries: any[]; currentUserId?: string }) {
  if (entries.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Leaderboard updates every 15s</div>;
  }
  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border/50">
        {entries.map((entry, rank) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 px-3 py-2.5 ${entry.userId === currentUserId ? "bg-primary/5" : "hover:bg-secondary/30"}`}
          >
            <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{rank + 1}</span>
            <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0" style={{ backgroundColor: entry.color }}>
              {entry.username[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate flex-1">{entry.username.split(" ")[0]}{entry.userId === currentUserId ? " (you)" : ""}</span>
            <div className="text-right shrink-0">
              <div className={`text-xs font-mono font-bold ${entry.growthPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {entry.growthPct >= 0 ? "+" : ""}{entry.growthPct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">{formatCurrency(entry.currentValue)}</div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function ChatPanel({ messages, onSend, currentUserId }: { messages: any[]; onSend: (t: string) => void; currentUserId?: string }) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {messages.slice(-100).map((m) => (
            <div key={m.id} className={`flex gap-2 items-start ${m.userId === currentUserId ? "flex-row-reverse" : ""}`}>
              <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black shrink-0 mt-0.5" style={{ backgroundColor: m.color }}>
                {m.username[0]?.toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${m.userId === currentUserId ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <span className={`text-[10px] text-muted-foreground ${m.userId === currentUserId ? "text-right" : ""}`}>{m.username.split(" ")[0]}</span>
                <div
                  className="px-2.5 py-1.5 rounded-xl text-xs leading-relaxed"
                  style={m.userId === currentUserId
                    ? { backgroundColor: m.color, color: "#000" }
                    : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--foreground))" }}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">No messages yet. Say hi!</div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <form onSubmit={submit} className="flex gap-2 p-2 border-t border-border">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message room..."
          className="flex-1 h-8 text-sm bg-secondary/30"
          maxLength={500}
        />
        <Button type="submit" size="sm" className="h-8 px-3" disabled={!text.trim()}>Send</Button>
      </form>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const code = params.code?.toUpperCase() ?? null;

  const room = useRoomWs(code);
  const { data: prices } = useGetPrices({ query: { queryKey: getGetPricesQueryKey() } });

  const [symbol, setSymbol] = useState("BTC");
  const [copied, setCopied] = useState(false);
  const [rightTab, setRightTab] = useState<"leaderboard" | "chat">("leaderboard");
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const cursorThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    room.sendWatching(symbol);
  }, [symbol]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartWrapRef.current) return;
    if (cursorThrottle.current) return;
    cursorThrottle.current = setTimeout(() => { cursorThrottle.current = null; }, 50);
    const rect = chartWrapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    room.sendCursor(x, y);
  }, [room.sendCursor]);

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success(`Room code copied: ${code}`);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const currentAsset = prices?.find((p) => p.symbol === symbol);

  return (
    <Layout>
      {/* Room Header Bar */}
      <div className="h-11 border-b border-border flex items-center justify-between px-4 bg-card/80 shrink-0">
        <div className="flex items-center gap-3">
          <StatusDot status={room.status} />
          {room.status === "connected" ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-sm font-semibold">{room.roomName ?? "Trading Room"}</span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 font-mono text-sm bg-secondary/50 hover:bg-secondary px-2.5 py-1 rounded-md transition-colors"
          >
            <span className="text-primary font-bold tracking-widest">{code}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <Badge variant="outline" className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {room.members.length} {room.members.length === 1 ? "member" : "members"}
          </Badge>
          <div className="flex items-center gap-1">
            {room.members.slice(0, 6).map((m) => (
              <div key={m.userId} className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black" style={{ backgroundColor: m.color }} title={m.username}>
                {m.username[0]?.toUpperCase()}
              </div>
            ))}
            {room.members.length > 6 && <span className="text-xs text-muted-foreground">+{room.members.length - 6}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/")}>
          Leave Room
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-[55%] flex flex-col border-r border-border shrink-0">
          {/* Asset Tabs + Watchers */}
          <div className="h-12 border-b border-border flex items-center px-4 justify-between bg-card shrink-0">
            <div className="flex items-center gap-1">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  onClick={() => setSymbol(a)}
                  className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${symbol === a ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {currentAsset && (
                <span className="text-base font-mono font-bold">{formatPrice(currentAsset.price, symbol)}</span>
              )}
              <WatchersBadge cursors={room.cursors} members={room.members} symbol={symbol} />
            </div>
          </div>

          {/* Chart + Cursor Overlay */}
          <div
            ref={chartWrapRef}
            className="flex-1 min-h-0 border-b border-border relative bg-[#0d1117] cursor-crosshair"
            onMouseMove={handleMouseMove}
          >
            <Chart symbol={symbol} />
            <RoomCursors cursors={room.cursors} currentSymbol={symbol} />
          </div>

          {/* Room Trade Feed */}
          <div className="h-44 shrink-0 flex flex-col">
            <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              Room Trades
            </div>
            <TradeFeed trades={room.trades} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[45%] flex flex-col shrink-0">
          {/* Trade Form */}
          <div className="h-[48%] border-b border-border overflow-hidden">
            <TradeForm symbol={symbol} />
          </div>

          {/* Leaderboard / Chat Tabs */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setRightTab("leaderboard")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${rightTab === "leaderboard" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Trophy className="h-3.5 w-3.5" /> Leaderboard
              </button>
              <button
                onClick={() => setRightTab("chat")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors relative ${rightTab === "chat" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat
                {room.messages.length > 0 && rightTab !== "chat" && (
                  <span className="absolute top-1.5 right-3 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {rightTab === "leaderboard" ? (
                <Leaderboard entries={room.leaderboard} currentUserId={user?.id} />
              ) : (
                <ChatPanel messages={room.messages} onSend={room.sendChat} currentUserId={user?.id} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
