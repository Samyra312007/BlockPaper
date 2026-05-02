import { useState, useEffect } from "react";
import { useGetOrders, getGetOrdersQueryKey, useGetChainTransactions, getGetChainTransactionsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatPrice } from "@/lib/format";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Link2, ShoppingBag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function truncateTxHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export default function History() {
  const [symbolFilter, setSymbolFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const queryParams = {
    symbol: symbolFilter || undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    limit: 100
  };

  const { data: orders, isLoading } = useGetOrders(queryParams, {
    query: { queryKey: getGetOrdersQueryKey(queryParams) }
  });

  const { data: chainTxs, isLoading: chainLoading } = useGetChainTransactions({
    query: { queryKey: getGetChainTransactionsQueryKey() }
  });

  // Listen for new on-chain executions from trade form
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: getGetChainTransactionsQueryKey() });
    };
    window.addEventListener("chain-tx-executed", handler);
    return () => window.removeEventListener("chain-tx-executed", handler);
  }, [queryClient]);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex flex-col h-full overflow-hidden">
        <h1 className="text-2xl font-bold tracking-tight shrink-0">Transaction History</h1>

        <Tabs defaultValue="orders" className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between shrink-0 mb-4">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="orders" className="gap-2 text-sm">
                <ShoppingBag className="h-3.5 w-3.5" />
                Paper Orders
              </TabsTrigger>
              <TabsTrigger value="chain" className="gap-2 text-sm">
                <Link2 className="h-3.5 w-3.5" />
                On-Chain Txns
                {chainTxs && chainTxs.length > 0 && (
                  <Badge className="ml-1 bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px] px-1.5 py-0 h-4">
                    {chainTxs.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-0 flex items-center gap-3">
              <Input
                placeholder="Filter by Symbol (e.g. BTC)"
                value={symbolFilter}
                onChange={e => setSymbolFilter(e.target.value.toUpperCase())}
                className="w-44 bg-card h-8 text-sm"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-card h-8 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </TabsContent>
          </div>

          <TabsContent value="orders" className="flex-1 min-h-0 mt-0">
            <Card className="flex-1 flex flex-col min-h-0 bg-card h-full">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-secondary/50 border-b border-border sticky top-0">
                    <tr>
                      <th className="font-medium px-6 py-3">Order ID</th>
                      <th className="font-medium px-6 py-3">Time</th>
                      <th className="font-medium px-6 py-3">Symbol</th>
                      <th className="font-medium px-6 py-3">Side</th>
                      <th className="font-medium px-6 py-3">Type</th>
                      <th className="font-medium px-6 py-3 text-right">Price</th>
                      <th className="font-medium px-6 py-3 text-right">Amount</th>
                      <th className="font-medium px-6 py-3 text-right">Total</th>
                      <th className="font-medium px-6 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {orders?.map(order => (
                      <tr key={order.id} className="hover:bg-secondary/30">
                        <td className="px-6 py-4 font-mono text-muted-foreground">#{order.id}</td>
                        <td className="px-6 py-4 font-mono">{format(new Date(order.createdAt), "MMM d, yyyy HH:mm:ss")}</td>
                        <td className="px-6 py-4 font-bold">{order.symbol}</td>
                        <td className={`px-6 py-4 font-medium ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{order.side.toUpperCase()}</td>
                        <td className="px-6 py-4 text-muted-foreground">{order.type.toUpperCase()}</td>
                        <td className="px-6 py-4 font-mono text-right">{order.type === 'market' ? 'MKT' : formatPrice(order.limitPrice || 0, 'USD')}</td>
                        <td className="px-6 py-4 font-mono text-right">{order.quantity}</td>
                        <td className="px-6 py-4 font-mono text-right">
                          {order.status === 'filled' ? formatPrice(order.price * order.quantity, 'USD') : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            order.status === 'filled' ? 'bg-green-500/10 text-green-500' :
                            order.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {order.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!isLoading && orders?.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No orders found matching filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="chain" className="flex-1 min-h-0 mt-0">
            <Card className="flex-1 flex flex-col min-h-0 bg-card h-full">
              <div className="flex-1 overflow-auto">
                {chainLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Loading on-chain transactions…</div>
                ) : !chainTxs || chainTxs.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Link2 className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-muted-foreground text-sm">No on-chain transactions yet.</p>
                    <p className="text-muted-foreground/60 text-xs">
                      Connect your MetaMask wallet and click "Execute on Chain" after placing a paper trade.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-secondary/50 border-b border-border sticky top-0">
                      <tr>
                        <th className="font-medium px-6 py-3">Tx Hash</th>
                        <th className="font-medium px-6 py-3">Time</th>
                        <th className="font-medium px-6 py-3">Wallet</th>
                        <th className="font-medium px-6 py-3">Symbol</th>
                        <th className="font-medium px-6 py-3">Side</th>
                        <th className="font-medium px-6 py-3 text-right">Qty</th>
                        <th className="font-medium px-6 py-3 text-right">Price</th>
                        <th className="font-medium px-6 py-3 text-right">Block</th>
                        <th className="font-medium px-6 py-3 text-right">Gas Used</th>
                        <th className="font-medium px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {chainTxs.map(tx => (
                        <tr key={tx.id} className="hover:bg-secondary/30">
                          <td className="px-6 py-4">
                            <button
                              onClick={() => window.open(`https://etherscan.io/tx/${tx.txHash}`, "_blank")}
                              className="font-mono text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 group"
                            >
                              {truncateTxHash(tx.txHash)}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                            {format(new Date(tx.createdAt), "MMM d, HH:mm:ss")}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                            {tx.walletAddress.slice(0, 6)}…{tx.walletAddress.slice(-4)}
                          </td>
                          <td className="px-6 py-4 font-bold">{tx.symbol}</td>
                          <td className={`px-6 py-4 font-medium ${tx.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                            {tx.side.toUpperCase()}
                          </td>
                          <td className="px-6 py-4 font-mono text-right">{parseFloat(tx.quantity).toFixed(4)}</td>
                          <td className="px-6 py-4 font-mono text-right">{formatPrice(parseFloat(tx.price), "USD")}</td>
                          <td className="px-6 py-4 font-mono text-right text-muted-foreground">#{tx.blockNumber.toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-right text-muted-foreground">{parseInt(tx.gasUsed).toLocaleString()}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-500/10 text-green-500">
                              ✓ CONFIRMED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
