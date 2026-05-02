import { useState, useCallback, useEffect } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { mainnet } from "viem/chains";

export interface WalletState {
  address: string | null;
  ethBalance: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

const STORAGE_KEY = "cryptodesk_wallet";

function getStoredWallet(): { address: string; ethBalance: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeWallet(address: string, ethBalance: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, ethBalance }));
}

function clearStoredWallet() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(() => {
    const stored = getStoredWallet();
    return {
      address: stored?.address ?? null,
      ethBalance: stored?.ethBalance ?? null,
      isConnecting: false,
      isConnected: !!stored,
      error: null,
    };
  });

  const connect = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setState((s) => ({ ...s, error: "MetaMask not found. Please install it." }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const client: WalletClient = createWalletClient({
        chain: mainnet,
        transport: custom(ethereum),
      });

      const [address] = await client.requestAddresses();
      if (!address) throw new Error("No accounts found");

      // 1. Request nonce from server
      const nonceRes = await fetch("/api/wallet/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get nonce");
      }
      const { message } = await nonceRes.json();

      // 2. Sign the message with MetaMask
      const signature = await client.signMessage({ account: address, message });

      // 3. Verify on server
      const verifyRes = await fetch("/api/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || "Verification failed");
      }
      const { ethBalance } = await verifyRes.json();

      storeWallet(address, ethBalance);
      setState({ address, ethBalance, isConnecting: false, isConnected: true, error: null });
    } catch (err: any) {
      const msg = err?.message?.includes("User rejected") ? "Connection cancelled" : (err?.message ?? "Connection failed");
      setState((s) => ({ ...s, isConnecting: false, error: msg }));
    }
  }, []);

  const disconnect = useCallback(() => {
    clearStoredWallet();
    setState({ address: null, ethBalance: null, isConnecting: false, isConnected: false, error: null });
  }, []);

  const executeOnChain = useCallback(
    async (params: { orderId: number; symbol: string; side: string; quantity: number; price: number }) => {
      const res = await fetch("/api/wallet/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Execution failed");
      }
      return res.json() as Promise<{
        txHash: string;
        blockNumber: number;
        gasUsed: string;
        status: string;
        executedAt: string;
      }>;
    },
    [],
  );

  return { ...state, connect, disconnect, executeOnChain };
}
