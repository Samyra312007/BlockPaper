# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Features

### Core Trading
- Paper trading with virtual $10,000 starting balance (BTC, ETH, SOL, BNB)
- Market + limit orders, holdings, P&L dashboard, order history
- Real-time price simulation with WebSocket-driven candle chart

### AI Sentinel Monitor
- `GET /api/sentinel/status` — GPT-4o-mini security scan every 5 min, SECURE/REVIEW/ALERT + score
- `SentinelPill` component polls every 30s, toasts on status changes

### Trading Rooms (Multiplayer)
- WebSocket server at `/api/ws` (auth via session cookie)
- `POST /rooms`, `GET /rooms/:code` REST endpoints
- Real-time: cursor positions, trade feed, live chat, leaderboard (every 15s)
- In-memory room store, garbage-collected 5 min after last member leaves

### Gamification
- **Daily Quests** (3/day, reset UTC midnight):
  - Market Maker: 3 trades → +$100 virtual
  - Bull Market: 5% portfolio return → +$50 + Bull Run badge
  - Diversifier: 3 different assets → +$50 + Hat Trick badge
- **Achievement Badges**: First Blood 🩸, Paper Hands 📄, Diamond Hands 💎, Hat Trick 🎯, Bull Run 🐂, Weekly Champion 🏆
- **Weekly Contest**: portfolio growth % leaderboard, prizes $500/$200/$100 distributed to top 3 every Monday
- Rewards credited to cash balance automatically; toasts fire in-app on quest/badge unlock
- DB tables: `user_badges`, `daily_quest_progress`, `weekly_contest`
- Routes: `/api/gamification/quests`, `/api/gamification/badges`, `/api/gamification/contest`
- Frontend: `/quests` page (Daily Quests / Badges / Weekly Contest tabs)

## Architecture Notes
- Server uses `http.createServer(app)` — do NOT revert to `app.listen()` (WS upgrade handler depends on this)
- New API endpoints (sentinel, rooms, gamification) use plain `fetch` — not Orval-generated hooks
- Room store is purely in-memory; does not survive server restarts
- Weekly prize monitor runs hourly via `setInterval`, executes only on Monday UTC midnight
