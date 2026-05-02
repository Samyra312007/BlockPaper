import { useState } from "react";
import { usePlaceOrder, useGetPrices, getGetPricesQueryKey, useGetAccount, getGetAccountQueryKey, useGetPortfolio, getGetPortfolioQueryKey, getGetOrdersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Link2, ExternalLink, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

interface TradeFormProps {
  symbol: string;
  defaultSide?: "buy" | "sell";
  defaultQuantity?: number;
}

export function TradeForm({ symbol, defaultSide, defaultQuantity }: TradeFormProps) {
  const [side, setSide] = useState<"buy" | "sell">(defaultSide ?? "buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState(defaultQuantity ? String(defaultQuantity) : "");
  const [limitPrice, setLimitPrice] = useState("");
  const [lastOrder, setLastOrder] = useState<{ id: number; qty: number; price: number } | null>(null);
  const [isExecutingChain, setIsExecutingChain] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: prices } = useGetPrices({ query: { queryKey: getGetPricesQueryKey() } });
  const { data: account } = useGetAccount({ query: { queryKey: getGetAccountQueryKey() } });
  const { data: portfolio } = useGetPortfolio({ query: { queryKey: getGetPortfolioQueryKey() } });
  const placeOrder = usePlaceOrder();
  const wallet = useWallet();

  const currentPrice = prices?.find(p => p.symbol === symbol)?.price || 0;
  const holding = portfolio?.holdings.find(h => h.symbol === symbol)?.quantity || 0;
  const estimatedTotal = parseFloat(quantity || "0") * (type === "market" ? currentPrice : parseFloat(limitPrice || "0"));
  const isAiPrefilled = !!(defaultSide && defaultQuantity);

  const onSubmit = () => {
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) { toast.error("Please enter a valid quantity"); return; }
    if (side === "buy" && estimatedTotal > (account?.cashBalance || 0)) { toast.error("Insufficient balance"); return; }
    if (side === "sell" && q > holding) { toast.error("Insufficient holdings"); return; }

    placeOrder.mutate({ data: { symbol, side, type, quantity: q, limitPrice: type === "limit" ? parseFloat(limitPrice) : undefined } }, {
      onSuccess: (order: any) => {
        toast.success(`Order placed: ${side.toUpperCase()} ${q} ${symbol}`);
        setLastOrder({ id: order.id, qty: q, price: order.price });
        setLastTxHash(null);
        setQuantity("");
        setLimitPrice("");
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["gamification"] });

        const gam = order.gamification as { newBadges: string[]; questsCompleted: string[]; totalReward: number } | undefined;
        if (gam) {
          const QUEST_NAMES: Record<string, string> = { trades_3: "Market Maker", return_5: "Bull Market", assets_3: "Diversifier" };
          const BADGE_NAMES: Record<string, string> = { first_blood: "First Blood 🩸", paper_hands: "Paper Hands 📄", diamond_hands: "Diamond Hands 💎", hat_trick: "Hat Trick 🎯", bull_run: "Bull Run 🐂", weekly_champ: "Weekly Champion 🏆" };
          for (const qId of gam.questsCompleted) {
            const name = QUEST_NAMES[qId] ?? qId;
            toast.success(`Quest complete: ${name}!`, { description: `+$${gam.totalReward} virtual dollars credited`, duration: 5000 });
          }
          for (const bId of gam.newBadges) {
            const name = BADGE_NAMES[bId] ?? bId;
            toast.success(`Badge unlocked: ${name}`, { description: "Visit Quests to see your badges", duration: 6000 });
          }
        }
      },
      onError: (err: any) => toast.error(err?.error || "Failed to place order"),
    });
  };

  const onExecuteChain = async () => {
    if (!lastOrder) return;
    if (!wallet.isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    setIsExecutingChain(true);
    try {
      const result = await wallet.executeOnChain({
        orderId: lastOrder.id,
        symbol,
        side,
        quantity: lastOrder.qty,
        price: lastOrder.price,
      });
      setLastTxHash(result.txHash);
      toast.success("Transaction confirmed on-chain!", {
        description: `Block #${result.blockNumber} · Gas: ${result.gasUsed}`,
        action: {
          label: "Etherscan ↗",
          onClick: () => window.open(`https://etherscan.io/tx/${result.txHash}`, "_blank"),
        },
        duration: 8000,
      });
      // refresh chain tx list via a custom event
      window.dispatchEvent(new CustomEvent("chain-tx-executed"));
    } catch (err: any) {
      toast.error(err?.message || "On-chain execution failed");
    } finally {
      setIsExecutingChain(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border font-medium flex justify-between items-center">
        <span>Order Ticket</span>
        <div className="flex items-center gap-2">
          {isAiPrefilled && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              <Zap className="h-2.5 w-2.5" /> AI Signal
            </span>
          )}
          <span className="text-sm font-mono text-muted-foreground">{symbol}</span>
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col space-y-4">
        <Tabs value={side} onValueChange={(v) => { setSide(v as any); setLastOrder(null); setLastTxHash(null); }} className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-secondary/50">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500">Sell</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={type} onValueChange={(v) => setType(v as any)} className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-transparent p-0 h-8">
            <TabsTrigger value="market" className="text-xs data-[state=active]:bg-secondary data-[state=active]:shadow-none">Market</TabsTrigger>
            <TabsTrigger value="limit" className="text-xs data-[state=active]:bg-secondary data-[state=active]:shadow-none">Limit</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3 flex-1">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <label>Quantity</label>
              <span>Avail: {side === "buy" ? formatPrice(account?.cashBalance || 0, "USD") : `${holding} ${symbol}`}</span>
            </div>
            <div className="relative">
              <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                className="pr-12 text-right font-mono bg-background border-border" placeholder="0.00" />
              <div className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">{symbol}</div>
            </div>
          </div>

          {type === "limit" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <label>Limit Price</label>
                <span>Current: {formatPrice(currentPrice, symbol)}</span>
              </div>
              <div className="relative">
                <Input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                  className="pr-12 text-right font-mono bg-background border-border" placeholder="0.00" />
                <div className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">USD</div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Estimated Total</span>
            <span className="font-mono font-medium">{formatPrice(estimatedTotal, "USD")}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            className={`w-full font-bold text-white ${side === "buy" ? "bg-[#26a641] hover:bg-[#26a641]/90" : "bg-[#f85149] hover:bg-[#f85149]/90"}`}
            onClick={onSubmit}
            disabled={placeOrder.isPending}
          >
            {placeOrder.isPending ? "Processing..." : `${side.toUpperCase()} ${symbol}`}
          </Button>

          {/* Execute on Chain — appears after a successful paper trade */}
          {lastOrder && (
            <div className="space-y-1.5">
              {lastTxHash ? (
                <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                    <Link2 className="h-3 w-3" /> On-chain confirmed
                  </div>
                  <button
                    onClick={() => window.open(`https://etherscan.io/tx/${lastTxHash}`, "_blank")}
                    className="font-mono text-[10px] text-green-300/70 hover:text-green-300 flex items-center gap-1 truncate w-full text-left"
                  >
                    {lastTxHash.slice(0, 22)}…{lastTxHash.slice(-8)}
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:text-violet-300 text-xs font-semibold"
                  onClick={onExecuteChain}
                  disabled={isExecutingChain || !wallet.isConnected}
                  title={!wallet.isConnected ? "Connect your wallet to execute on-chain" : undefined}
                >
                  {isExecutingChain ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Broadcasting…</>
                  ) : (
                    <><Link2 className="h-3.5 w-3.5" /> Execute on Chain{!wallet.isConnected && " (connect wallet)"}</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
