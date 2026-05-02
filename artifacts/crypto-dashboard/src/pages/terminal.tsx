import { useState } from "react";
import { useGetPrices, getGetPricesQueryKey, useGetOrders, getGetOrdersQueryKey, useGetPortfolio, getGetPortfolioQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Ticker } from "@/components/terminal/ticker";
import { Chart } from "@/components/terminal/chart";
import { TradeForm } from "@/components/terminal/trade-form";
import { formatPrice } from "@/lib/format";
import { format } from "date-fns";

const ASSETS = ["BTC", "ETH", "SOL", "BNB"];

function HoldingSummary({ symbol }: { symbol: string }) {
  const { data: portfolio } = useGetPortfolio({ query: { queryKey: getGetPortfolioQueryKey() } });
  
  const holding = portfolio?.holdings.find((h) => h.symbol === symbol);

  if (!holding || holding.quantity === 0) {
    return <div className="text-center space-y-1"><div className="text-sm">No position in {symbol}</div></div>;
  }

  const isProfit = holding.unrealizedPnl >= 0;

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Size</div>
          <div className="text-2xl font-mono font-bold">{holding.quantity} <span className="text-sm text-muted-foreground">{symbol}</span></div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground mb-1">Value</div>
          <div className="text-xl font-mono">{formatPrice(holding.currentValue, "USD")}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Avg Entry</div>
          <div className="font-mono text-sm">{formatPrice(holding.averageCost, "USD")}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Unrealized P&L</div>
          <div className={`font-mono text-sm font-medium ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
            {isProfit ? '+' : ''}{formatPrice(holding.unrealizedPnl, "USD")} ({isProfit ? '+' : ''}{holding.unrealizedPnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Terminal() {
  const [symbol, setSymbol] = useState("BTC");
  const { data: prices } = useGetPrices({ query: { queryKey: getGetPricesQueryKey() } });
  const { data: orders } = useGetOrders({ limit: 10, symbol }, { query: { queryKey: getGetOrdersQueryKey({ limit: 10, symbol }) } });

  const currentAsset = prices?.find(p => p.symbol === symbol);

  return (
    <Layout>
      <Ticker />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-[60%] flex flex-col border-r border-border shrink-0">
          {/* Asset Header */}
          <div className="h-14 border-b border-border flex items-center px-4 justify-between bg-card">
            <div className="flex items-center gap-1">
              {ASSETS.map(a => (
                <button
                  key={a}
                  onClick={() => setSymbol(a)}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${symbol === a ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                >
                  {a}
                </button>
              ))}
            </div>
            {currentAsset && (
              <div className="flex items-center gap-4">
                <span className="text-xl font-mono font-bold tracking-tight">{formatPrice(currentAsset.price, symbol)}</span>
                <span className={`text-sm font-mono font-medium px-2 py-0.5 rounded ${currentAsset.changePercent24h >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                  {currentAsset.changePercent24h >= 0 ? "+" : ""}{currentAsset.changePercent24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          
          {/* Chart */}
          <div className="flex-1 min-h-0 border-b border-border p-1 bg-[#0d1117]">
            <Chart symbol={symbol} />
          </div>
          
          {/* Recent Orders (Mini) */}
          <div className="h-48 bg-card flex flex-col shrink-0">
            <div className="px-4 py-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Orders - {symbol}
            </div>
            <div className="flex-1 overflow-auto p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="font-medium px-4 py-2">Time</th>
                    <th className="font-medium px-4 py-2">Side</th>
                    <th className="font-medium px-4 py-2">Type</th>
                    <th className="font-medium px-4 py-2 text-right">Price</th>
                    <th className="font-medium px-4 py-2 text-right">Amount</th>
                    <th className="font-medium px-4 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {orders?.map(order => (
                    <tr key={order.id} className="hover:bg-secondary/50">
                      <td className="px-4 py-2 font-mono text-muted-foreground">{format(new Date(order.createdAt), "HH:mm:ss")}</td>
                      <td className={`px-4 py-2 font-medium ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{order.side.toUpperCase()}</td>
                      <td className="px-4 py-2 text-muted-foreground">{order.type.toUpperCase()}</td>
                      <td className="px-4 py-2 font-mono text-right">{order.type === 'market' ? 'MKT' : formatPrice(order.limitPrice || 0, 'USD')}</td>
                      <td className="px-4 py-2 font-mono text-right">{order.quantity}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'filled' ? 'bg-green-500/10 text-green-500' : order.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!orders?.length && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">No recent orders for {symbol}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[40%] flex flex-col shrink-0 border-l border-border">
          <div className="h-[55%] min-h-[400px]">
            <TradeForm symbol={symbol} />
          </div>
          <div className="flex-1 border-t border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border font-medium">Position</div>
            <div className="p-4 flex-1 flex items-center justify-center text-muted-foreground">
               <HoldingSummary symbol={symbol} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
