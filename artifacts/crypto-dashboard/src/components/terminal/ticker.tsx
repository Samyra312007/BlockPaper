import { useGetPrices, getGetPricesQueryKey } from "@workspace/api-client-react";
import { formatPrice, formatPercent } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export function Ticker() {
  const { data: prices, isLoading } = useGetPrices({ query: { refetchInterval: 10000, queryKey: getGetPricesQueryKey() } });

  if (isLoading) {
    return <div className="h-10 border-b border-border bg-card flex items-center px-4"><Skeleton className="h-4 w-full max-w-2xl" /></div>;
  }

  if (!prices) return null;

  return (
    <div className="h-10 border-b border-border bg-card flex items-center overflow-x-auto no-scrollbar shrink-0">
      <div className="flex items-center space-x-6 px-4">
        {prices.map((asset) => (
          <div key={asset.symbol} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm font-bold text-muted-foreground">{asset.symbol}</span>
            <span className="text-sm font-mono">{formatPrice(asset.price, asset.symbol)}</span>
            <span className={`text-xs font-mono font-medium ${asset.changePercent24h >= 0 ? "text-green-500" : "text-red-500"}`}>
              {asset.changePercent24h >= 0 ? "+" : ""}{formatPercent(asset.changePercent24h)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
