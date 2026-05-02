import { Router } from "express";
import crypto from "crypto";
import { verifyMessage } from "viem";
import { db } from "@workspace/db";
import { walletNoncesTable, chainTransactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function mockEthBalance(address: string): string {
  const seed = address.toLowerCase().split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const whole = ((seed % 20) + 1).toString();
  const decimal = ((seed * 137) % 1000).toString().padStart(3, "0");
  return `${whole}.${decimal}`;
}

function generateMockTxHash(): string {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

function generateMockBlockNumber(): number {
  return 19_800_000 + Math.floor(Math.random() * 200_000);
}

function generateMockGas(): string {
  const gas = 45_000 + Math.floor(Math.random() * 30_000);
  return gas.toString();
}

router.post("/wallet/nonce", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { address } = req.body as { address?: string };
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid Ethereum address" });
    return;
  }

  const userId = req.user!.id;
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await db.insert(walletNoncesTable).values({
    userId,
    walletAddress: address.toLowerCase(),
    nonce,
    used: false,
    expiresAt,
  });

  const message = `CryptoDesk wants to verify your wallet ownership.\n\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;

  res.json({ nonce, message });
});

router.post("/wallet/verify", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { address, signature } = req.body as { address?: string; signature?: string };
  if (!address || !signature) {
    res.status(400).json({ error: "Missing address or signature" });
    return;
  }

  const userId = req.user!.id;
  const normalizedAddress = address.toLowerCase();

  const [nonceRow] = await db
    .select()
    .from(walletNoncesTable)
    .where(
      and(
        eq(walletNoncesTable.userId, userId),
        eq(walletNoncesTable.walletAddress, normalizedAddress),
        eq(walletNoncesTable.used, false),
      ),
    )
    .orderBy(desc(walletNoncesTable.createdAt))
    .limit(1);

  if (!nonceRow) {
    res.status(400).json({ error: "No pending nonce found. Please request a new one." });
    return;
  }

  if (new Date() > nonceRow.expiresAt) {
    res.status(400).json({ error: "Nonce expired. Please request a new one." });
    return;
  }

  const message = `CryptoDesk wants to verify your wallet ownership.\n\nNonce: ${nonceRow.nonce}\nExpires: ${nonceRow.expiresAt.toISOString()}`;

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Signature verification failed" });
    return;
  }

  // Mark nonce as used
  await db
    .update(walletNoncesTable)
    .set({ used: true })
    .where(eq(walletNoncesTable.id, nonceRow.id));

  res.json({
    address,
    ethBalance: mockEthBalance(address),
    verified: true,
  });
});

router.post("/wallet/execute", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const { orderId, symbol, side, quantity, price } = req.body as {
    orderId?: number;
    symbol?: string;
    side?: string;
    quantity?: number;
    price?: number;
    walletAddress?: string;
  };

  if (!symbol || !side || !quantity || !price) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const userId = req.user!.id;

  // Find the most recently verified wallet for this user
  const [latestNonce] = await db
    .select()
    .from(walletNoncesTable)
    .where(and(eq(walletNoncesTable.userId, userId), eq(walletNoncesTable.used, true)))
    .orderBy(desc(walletNoncesTable.createdAt))
    .limit(1);

  if (!latestNonce) {
    res.status(400).json({ error: "No verified wallet. Connect your wallet first." });
    return;
  }

  const walletAddress = latestNonce.walletAddress;
  const txHash = generateMockTxHash();
  const blockNumber = generateMockBlockNumber();
  const gasUsed = generateMockGas();
  const executedAt = new Date();

  await db.insert(chainTransactionsTable).values({
    userId,
    walletAddress,
    orderId: orderId ?? 0,
    txHash,
    symbol: symbol.toUpperCase(),
    side,
    quantity: String(quantity),
    price: String(price),
    status: "confirmed",
    blockNumber,
    gasUsed,
  });

  res.json({
    txHash,
    blockNumber,
    gasUsed,
    status: "confirmed",
    executedAt: executedAt.toISOString(),
  });
});

router.get("/wallet/transactions", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const userId = req.user!.id;

  const txs = await db
    .select()
    .from(chainTransactionsTable)
    .where(eq(chainTransactionsTable.userId, userId))
    .orderBy(desc(chainTransactionsTable.createdAt))
    .limit(100);

  res.json(
    txs.map((tx) => ({
      id: tx.id,
      walletAddress: tx.walletAddress,
      txHash: tx.txHash,
      symbol: tx.symbol,
      side: tx.side,
      quantity: tx.quantity,
      price: tx.price,
      status: tx.status,
      blockNumber: tx.blockNumber,
      gasUsed: tx.gasUsed,
      createdAt: tx.createdAt.toISOString(),
    })),
  );
});

export default router;
