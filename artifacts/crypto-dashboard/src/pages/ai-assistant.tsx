import { useState, useRef, useEffect } from "react";
import { useGetAiSignals, useGetMarketSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatPrice } from "@/lib/format";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Minus, Bot, Send, RefreshCw,
  Zap, Activity, BarChart2, Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "Should I buy BTC right now?",
  "What's the current market sentiment?",
  "Which asset has the best momentum?",
  "Explain the MACD signal for ETH",
];

function SignalBadge({ signal }: { signal: string }) {
  if (signal === "BUY") return (
    <Badge className="bg-green-500/15 text-green-400 border-green-500/30 font-bold text-sm px-3 py-1">
      <TrendingUp className="h-3.5 w-3.5 mr-1" /> BUY
    </Badge>
  );
  if (signal === "SELL") return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 font-bold text-sm px-3 py-1">
      <TrendingDown className="h-3.5 w-3.5 mr-1" /> SELL
    </Badge>
  );
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold text-sm px-3 py-1">
      <Minus className="h-3.5 w-3.5 mr-1" /> HOLD
    </Badge>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Confidence</span>
        <span className="font-mono font-medium">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! I'm your AI trading assistant. I can analyze market conditions, explain technical indicators, and help you make informed paper trading decisions. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: signalsData, isLoading: signalsLoading, refetch: refetchSignals } = useGetAiSignals();
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useGetMarketSummary();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newHistory, assistantMsg]);

    try {
      const res = await fetch("/api/openai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              accumulated += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, I couldn't connect to the AI service. Please try again." };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleOneClickTrade(symbol: string, side: string, quantity: number, price: number) {
    navigate(`/?symbol=${symbol}&side=${side}&quantity=${quantity}&price=${price.toFixed(2)}`);
    toast.success(`Pre-filling ${side.toUpperCase()} order for ${symbol}`, { description: "Trade form loaded on terminal" });
  }

  function handleRefresh() {
    refetchSignals();
    refetchSummary();
    toast.info("Refreshing AI analysis...");
  }

  const sentimentColor = summaryData?.sentiment === "bullish" ? "text-green-400" : summaryData?.sentiment === "bearish" ? "text-red-400" : "text-amber-400";
  const sentimentBg = summaryData?.sentiment === "bullish" ? "bg-green-500/10 border-green-500/20" : summaryData?.sentiment === "bearish" ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20";

  return (
    <Layout>
      <div className="flex-1 overflow-auto p-4 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">AI Trading Assistant</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Powered by GPT
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Analysis
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left column: Market Summary + Signals */}
          <div className="xl:col-span-2 space-y-4">
            {/* Market Summary */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Daily Market Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-secondary rounded w-3/4" />
                    <div className="h-4 bg-secondary rounded w-1/2" />
                  </div>
                ) : summaryData ? (
                  <div className="space-y-4">
                    <div className={`flex items-center gap-2 w-fit px-3 py-1 rounded-full border text-sm font-medium ${sentimentBg} ${sentimentColor}`}>
                      {summaryData.sentiment === "bullish" ? <TrendingUp className="h-3.5 w-3.5" /> : summaryData.sentiment === "bearish" ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      {summaryData.sentiment.toUpperCase()} MARKET
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{summaryData.summary}</p>
                    <div className="space-y-1.5">
                      {summaryData.keyPoints.map((pt, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary font-bold mt-0.5">›</span>
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Click "Refresh Analysis" to generate today's market summary.</p>
                )}
              </CardContent>
            </Card>

            {/* Signals Grid */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">AI Trading Signals</h2>
              </div>
              {signalsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => (
                    <Card key={i} className="bg-card border-border animate-pulse">
                      <CardContent className="p-4 space-y-3">
                        <div className="h-5 bg-secondary rounded w-1/3" />
                        <div className="h-4 bg-secondary rounded w-full" />
                        <div className="h-4 bg-secondary rounded w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : signalsData?.signals && signalsData.signals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {signalsData.signals.map((sig) => (
                    <Card key={sig.symbol} className="bg-card border-border hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-lg">{sig.symbol}</span>
                            <div className="text-xs text-muted-foreground font-mono">{formatPrice(sig.suggestedPrice, "USD")}</div>
                          </div>
                          <SignalBadge signal={sig.signal} />
                        </div>

                        <ConfidenceBar value={sig.confidence} />

                        <p className="text-xs text-muted-foreground leading-relaxed">{sig.reasoning}</p>

                        {/* Technical indicators mini grid */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">RSI</div>
                            <div className={`text-xs font-mono font-bold ${sig.technicals.rsi > 70 ? "text-red-400" : sig.technicals.rsi < 30 ? "text-green-400" : "text-foreground"}`}>
                              {sig.technicals.rsi.toFixed(1)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">MACD</div>
                            <div className={`text-xs font-mono font-bold ${sig.technicals.macd >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {sig.technicals.macd >= 0 ? "+" : ""}{sig.technicals.macd.toFixed(1)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground">SMA20</div>
                            <div className="text-xs font-mono font-bold">${sig.technicals.sma20.toFixed(0)}</div>
                          </div>
                        </div>

                        {sig.signal !== "HOLD" && (
                          <Button
                            size="sm"
                            className={`w-full gap-2 text-xs ${sig.signal === "BUY" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
                            onClick={() => handleOneClickTrade(sig.symbol, sig.signal === "BUY" ? "buy" : "sell", sig.suggestedQuantity, sig.suggestedPrice)}
                          >
                            <Zap className="h-3 w-3" />
                            One-Click {sig.signal} {sig.suggestedQuantity} {sig.symbol}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    Click "Refresh Analysis" to generate AI trading signals.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right column: Chat */}
          <div className="flex flex-col h-[calc(100vh-9rem)] min-h-[500px]">
            <Card className="bg-card border-border flex flex-col flex-1 overflow-hidden">
              <CardHeader className="pb-3 shrink-0 border-b border-border">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Ask the AI
                </CardTitle>
              </CardHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bot className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">AI Assistant</span>
                        </div>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                        <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse rounded-sm" />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick questions */}
              <div className="px-4 pb-2 shrink-0">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={isStreaming}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 border border-border"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="p-4 pt-2 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder="Ask about market conditions..."
                    disabled={isStreaming}
                    className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                  <Button size="sm" onClick={() => sendMessage(input)} disabled={isStreaming || !input.trim()} className="shrink-0 w-9 h-9 p-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
