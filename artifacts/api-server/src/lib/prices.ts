import { logger } from "./logger";

export interface AssetPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  updatedAt: Date;
}

const BASE_PRICES: Record<string, { name: string; price: number; volume: number; marketCap: number }> = {
  BTC: { name: "Bitcoin", price: 67000, volume: 28_000_000_000, marketCap: 1_320_000_000_000 },
  ETH: { name: "Ethereum", price: 3500, volume: 14_000_000_000, marketCap: 420_000_000_000 },
  SOL: { name: "Solana", price: 180, volume: 3_500_000_000, marketCap: 82_000_000_000 },
  BNB: { name: "BNB", price: 560, volume: 1_800_000_000, marketCap: 84_000_000_000 },
};

const currentPrices: Record<string, AssetPrice> = {};

function randomWalk(current: number, maxPct = 0.002): number {
  const change = current * maxPct * (Math.random() * 2 - 1);
  return Math.max(current + change, current * 0.001);
}

function initPrices() {
  const now = new Date();
  for (const [symbol, base] of Object.entries(BASE_PRICES)) {
    const price = base.price * (0.95 + Math.random() * 0.1);
    const change24h = price * (Math.random() * 0.08 - 0.04);
    currentPrices[symbol] = {
      symbol,
      name: base.name,
      price,
      change24h,
      changePercent24h: (change24h / (price - change24h)) * 100,
      volume24h: base.volume * (0.8 + Math.random() * 0.4),
      marketCap: base.marketCap * (0.95 + Math.random() * 0.1),
      high24h: price * 1.02,
      low24h: price * 0.98,
      updatedAt: now,
    };
  }
}

function tickPrices() {
  const now = new Date();
  for (const symbol of Object.keys(currentPrices)) {
    const current = currentPrices[symbol];
    const newPrice = randomWalk(current.price);
    const high = Math.max(current.high24h, newPrice);
    const low = Math.min(current.low24h, newPrice);
    const openPrice24h = newPrice - current.change24h;
    const change24h = newPrice - openPrice24h;
    currentPrices[symbol] = {
      ...current,
      price: newPrice,
      change24h,
      changePercent24h: openPrice24h > 0 ? (change24h / openPrice24h) * 100 : 0,
      high24h: high,
      low24h: low,
      updatedAt: now,
    };
  }
  logger.debug("prices updated");
}

export function getAllPrices(): AssetPrice[] {
  return Object.values(currentPrices);
}

export function getPrice(symbol: string): AssetPrice | undefined {
  return currentPrices[symbol.toUpperCase()];
}

export function startPriceSimulation() {
  initPrices();
  setInterval(tickPrices, 10_000);
  logger.info("price simulation started");
}
