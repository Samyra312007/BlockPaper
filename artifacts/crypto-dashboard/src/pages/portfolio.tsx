import { useGetPortfolio, getGetPortfolioQueryKey, useGetPortfolioSummary, getGetPortfolioSummaryQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatPrice, formatPercent, cnPnl } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Portfolio() {
  const { data: summary, isLoading: sumLoading } = useGetPortfolioSummary({ query: { queryKey: getGetPortfolioSummaryQueryKey() } });
  const { data: portfolio, isLoading: portLoading } = useGetPortfolio({ query: { queryKey: getGetPortfolioQueryKey() } });

  const COLORS = ['#2f81f7', '#a371f7', '#26a641', '#f85149', '#d29922'];

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Portfolio Overview</h1>
        
        {sumLoading ? (
          <div className="grid grid-cols-4 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        ) : summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card">
              <CardHeader className="pb-2 text-muted-foreground"><CardTitle className="text-sm font-medium">Total Value</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-mono font-bold">{formatPrice(summary.totalPortfolioValue, "USD")}</div></CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2 text-muted-foreground"><CardTitle className="text-sm font-medium">Cash Balance</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-mono">{formatPrice(summary.cashBalance, "USD")}</div></CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2 text-muted-foreground"><CardTitle className="text-sm font-medium">Day P&L</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-2xl font-mono font-bold ${cnPnl(summary.dayPnl)}`}>
                  {summary.dayPnl > 0 ? '+' : ''}{formatPrice(summary.dayPnl, "USD")}
                </div>
                <div className={`text-sm font-mono ${cnPnl(summary.dayPnl)}`}>
                  {summary.dayPnlPercent > 0 ? '+' : ''}{summary.dayPnlPercent.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="pb-2 text-muted-foreground"><CardTitle className="text-sm font-medium">All-Time P&L</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-2xl font-mono font-bold ${cnPnl(summary.allTimePnl)}`}>
                  {summary.allTimePnl > 0 ? '+' : ''}{formatPrice(summary.allTimePnl, "USD")}
                </div>
                <div className={`text-sm font-mono ${cnPnl(summary.allTimePnl)}`}>
                  {summary.allTimePnlPercent > 0 ? '+' : ''}{summary.allTimePnlPercent.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <Card className="bg-card lg:col-span-2 flex flex-col">
            <CardHeader><CardTitle className="text-lg">Holdings</CardTitle></CardHeader>
            <CardContent className="flex-1 p-0 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-secondary/50 border-y border-border">
                  <tr>
                    <th className="font-medium px-4 py-3">Asset</th>
                    <th className="font-medium px-4 py-3 text-right">Quantity</th>
                    <th className="font-medium px-4 py-3 text-right">Avg Cost</th>
                    <th className="font-medium px-4 py-3 text-right">Price</th>
                    <th className="font-medium px-4 py-3 text-right">Value</th>
                    <th className="font-medium px-4 py-3 text-right">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {portfolio?.holdings.map(h => (
                    <tr key={h.symbol} className="hover:bg-secondary/30">
                      <td className="px-4 py-4">
                        <div className="font-bold">{h.symbol}</div>
                        <div className="text-xs text-muted-foreground">{h.name}</div>
                      </td>
                      <td className="px-4 py-4 font-mono text-right">{h.quantity}</td>
                      <td className="px-4 py-4 font-mono text-right">{formatPrice(h.averageCost, "USD")}</td>
                      <td className="px-4 py-4 font-mono text-right">{formatPrice(h.currentPrice, "USD")}</td>
                      <td className="px-4 py-4 font-mono text-right font-medium">{formatPrice(h.currentValue, "USD")}</td>
                      <td className="px-4 py-4 text-right">
                        <div className={`font-mono font-medium ${cnPnl(h.unrealizedPnl)}`}>
                          {h.unrealizedPnl > 0 ? '+' : ''}{formatPrice(h.unrealizedPnl, "USD")}
                        </div>
                        <div className={`text-xs font-mono ${cnPnl(h.unrealizedPnl)}`}>
                          {h.unrealizedPnlPercent > 0 ? '+' : ''}{h.unrealizedPnlPercent.toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                  {portfolio?.holdings.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No open positions.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle className="text-lg">Allocation</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center">
              {summary && summary.allocation.length > 0 ? (
                <div className="w-full h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.allocation}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {summary.allocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: number) => formatPrice(val, "USD")} 
                        contentStyle={{ backgroundColor: '#161b22', borderColor: '#21262d', color: '#e6edf3' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">No allocation data</div>
              )}
              
              <div className="w-full space-y-2 mt-4">
                {summary?.allocation.map((a, i) => (
                  <div key={a.symbol} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-medium">{a.symbol}</span>
                    </div>
                    <span className="font-mono">{a.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
