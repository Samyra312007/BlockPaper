import { useState } from "react";
import { usePlaceOrder, useGetPrices, getGetPricesQueryKey, useGetAccount, getGetAccountQueryKey, useGetPortfolio, getGetPortfolioQueryKey, getGetOrdersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function TradeForm({ symbol }: { symbol: string }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  const queryClient = useQueryClient();
  const { data: prices } = useGetPrices({ query: { queryKey: getGetPricesQueryKey() } });
  const { data: account } = useGetAccount({ query: { queryKey: getGetAccountQueryKey() } });
  const { data: portfolio } = useGetPortfolio({ query: { queryKey: getGetPortfolioQueryKey() } });
  const placeOrder = usePlaceOrder();

  const currentPrice = prices?.find(p => p.symbol === symbol)?.price || 0;
  const holding = portfolio?.holdings.find(h => h.symbol === symbol)?.quantity || 0;
  
  const estimatedTotal = parseFloat(quantity || "0") * (type === "market" ? currentPrice : parseFloat(limitPrice || "0"));

  const onSubmit = () => {
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (side === "buy" && estimatedTotal > (account?.cashBalance || 0)) {
      toast.error("Insufficient balance");
      return;
    }
    if (side === "sell" && q > holding) {
      toast.error("Insufficient holdings");
      return;
    }

    placeOrder.mutate({
      data: {
        symbol,
        side,
        type,
        quantity: q,
        limitPrice: type === "limit" ? parseFloat(limitPrice) : undefined,
      }
    }, {
      onSuccess: () => {
        toast.success(`Order placed: ${side.toUpperCase()} ${q} ${symbol}`);
        setQuantity("");
        setLimitPrice("");
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err?.error || "Failed to place order");
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b border-border font-medium flex justify-between items-center">
        <span>Order Ticket</span>
        <span className="text-sm font-mono text-muted-foreground">{symbol}</span>
      </div>
      
      <div className="p-4 flex-1 flex flex-col space-y-6">
        <Tabs value={side} onValueChange={(v) => setSide(v as any)} className="w-full">
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

        <div className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <label>Quantity</label>
              <span>Avail: {side === "buy" ? formatPrice(account?.cashBalance || 0, "USD") : `${holding} ${symbol}`}</span>
            </div>
            <div className="relative">
              <Input 
                type="number" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                className="pr-12 text-right font-mono bg-background border-border"
                placeholder="0.00"
              />
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
                <Input 
                  type="number" 
                  value={limitPrice} 
                  onChange={e => setLimitPrice(e.target.value)} 
                  className="pr-12 text-right font-mono bg-background border-border"
                  placeholder="0.00"
                />
                <div className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">USD</div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Estimated Total</span>
            <span className="font-mono font-medium">{formatPrice(estimatedTotal, "USD")}</span>
          </div>
        </div>

        <Button 
          className={`w-full font-bold text-white ${side === "buy" ? "bg-[#26a641] hover:bg-[#26a641]/90" : "bg-[#f85149] hover:bg-[#f85149]/90"}`}
          onClick={onSubmit}
          disabled={placeOrder.isPending}
        >
          {placeOrder.isPending ? "Processing..." : `${side.toUpperCase()} ${symbol}`}
        </Button>
      </div>
    </div>
  );
}
