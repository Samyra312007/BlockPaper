# BlockPaper

A full-stack crypto paper trading platform built with React, Express, and PostgreSQL. Practice trading Bitcoin, Ethereum, Solana, and BNB with $10,000 in virtual cash no real money at risk.

**Live:** https://crypto-dashboard-demo--samayra312007.replit.app

---

## Features

### Trading
- Market and limit orders across BTC, ETH, SOL, BNB
- Real-time price simulation via WebSocket-driven candlestick chart
- Holdings tracker, unrealized P&L, and full order history
- Virtual $10,000 starting balance

### Auth
- Email/password sign-up and sign-in
- Google OAuth (one-click)
- Forgot password flow with email reset links (via Resend)
- Session-based auth with secure HTTP-only cookies

### Multiplayer Trading Rooms
- Create or join rooms with a shareable code
- Live cursor tracking, trade feed, and in-room chat
- Real-time leaderboard updated every 15 seconds

### AI Features
- **Sentinel Monitor** — GPT-4o-mini security scan every 5 minutes; rates your portfolio SECURE / REVIEW / ALERT with a score
- **Backtesting Engine** — test SMA Crossover, RSI, and Bollinger Bands strategies against 111 days of historical data; describe a strategy in plain English and AI converts it
- **Market Sentiment Gauge** — 0–100 fear/greed score with animated SVG gauge, AI-generated market quote, and 7-day history chart

### Gamification
- **Daily Quests** — 3 quests per day (Market Maker, Bull Market, Diversifier) with virtual cash rewards
- **Achievement Badges** — First Blood, Paper Hands, Diamond Hands, Hat Trick, Bull Run, Weekly Champion
- **Weekly Contest** — portfolio growth leaderboard; top 3 win $500 / $200 / $100 virtual cash every Monday

### Analytics
- **Portfolio Heatmap** — color-coded tiles showing 24h / 7d change or total P&L; click any tile to trade that asset
- **Price Alerts** — set above/below triggers (one-time or recurring); browser notifications + in-app bell with unread badge

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Recharts, Wouter |
| Backend | Express 5, Node.js 24, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Real-time | WebSockets (ws) |
| Auth | Custom session auth + Google OAuth 2.0 |
| Email | Resend |
| AI | OpenAI GPT-4o-mini |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Express API + WebSocket server
│   └── crypto-dashboard/    # React + Vite frontend
├── lib/
│   ├── db/                  # Drizzle schema + migrations
│   ├── api-spec/            # OpenAPI spec + Orval codegen
│   └── replit-auth-web/     # useAuth hook
└── scripts/                 # Shared utility scripts
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `RESEND_API_KEY` | Yes | Resend API key for password reset emails |
| `OPENAI_API_KEY` | Yes | OpenAI key for AI features (Sentinel, Backtest, Sentiment) |
| `SESSION_SECRET` | Yes | Secret for signing session cookies |

---

## Local Development

**Prerequisites:** Node.js 24+, pnpm, PostgreSQL

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start both servers (in separate terminals)
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/crypto-dashboard run dev
```

The API runs on port `8080` and the frontend on whatever `PORT` is set to.

---

## Google OAuth Setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create (or edit) an OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**:
   - `http://localhost:3000` (dev)
   - `https://your-app.replit.app` (production)
4. Add to **Authorized redirect URIs**:
   - `http://localhost:8080/api/auth/google/callback` (dev)
   - `https://your-app.replit.app/api/auth/google/callback` (production)

---

## Key Commands

```bash
pnpm run typecheck                          # Full TypeScript check
pnpm --filter @workspace/api-spec run codegen   # Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/db run push        # Push schema changes to DB
```

---

## API Overview

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register with email + password |
| POST | `/api/auth/signin` | Sign in with email + password |
| GET | `/api/auth/google` | Start Google OAuth flow |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Set new password from token |
| GET | `/api/wallet` | Get balance + holdings |
| POST | `/api/orders` | Place market or limit order |
| GET | `/api/sentinel/status` | AI security scan result |
| POST | `/api/backtest` | Run a backtest strategy |
| GET | `/api/sentiment` | Fear/greed score + history |
| GET | `/api/heatmap` | Asset heatmap data |
| GET | `/api/alerts` | List active price alerts |
| POST | `/api/alerts` | Create a price alert |
| GET | `/api/gamification/quests` | Daily quest progress |
| GET | `/api/gamification/badges` | Earned badges |
| POST | `/rooms` | Create a trading room |
| GET | `/rooms/:code` | Join a trading room |

---
