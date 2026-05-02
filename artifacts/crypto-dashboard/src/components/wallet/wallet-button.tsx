import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronDown, Power, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletButton() {
  const { address, ethBalance, isConnecting, isConnected, error, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 font-mono text-xs"
          >
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            {truncateAddress(address)}
            <span className="text-green-300/60 hidden sm:inline">·</span>
            <span className="text-green-300/80 hidden sm:inline">{ethBalance} ETH</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <div className="px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Connected Wallet</div>
            <div className="font-mono text-xs text-foreground break-all">{address}</div>
            <div className="mt-1 text-xs text-green-400 font-medium">{ethBalance} ETH</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs gap-2 cursor-pointer"
            onClick={() => window.open(`https://etherscan.io/address/${address}`, "_blank")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Etherscan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs gap-2 cursor-pointer text-red-400 focus:text-red-400"
            onClick={disconnect}
          >
            <Power className="h-3.5 w-3.5" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={connect}
        disabled={isConnecting}
        className="gap-2 border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs"
      >
        <Wallet className="h-3.5 w-3.5" />
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </Button>
      {error && <span className="text-[10px] text-red-400 max-w-[180px] text-right">{error}</span>}
    </div>
  );
}
