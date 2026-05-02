import { useState } from "react";
import { useGetOrders, getGetOrdersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatPrice } from "@/lib/format";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function History() {
  const [symbolFilter, setSymbolFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const queryParams = { 
    symbol: symbolFilter || undefined, 
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    limit: 100
  };
  
  const { data: orders, isLoading } = useGetOrders(queryParams, { 
    query: { queryKey: getGetOrdersQueryKey(queryParams) } 
  });

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6 flex flex-col h-full overflow-hidden">
        <h1 className="text-2xl font-bold tracking-tight shrink-0">Order History</h1>
        
        <div className="flex items-center gap-4 shrink-0">
          <Input 
            placeholder="Filter by Symbol (e.g. BTC)" 
            value={symbolFilter} 
            onChange={e => setSymbolFilter(e.target.value.toUpperCase())}
            className="w-48 bg-card"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="filled">Filled</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="flex-1 flex flex-col min-h-0 bg-card">
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
      </div>
    </Layout>
  );
}
