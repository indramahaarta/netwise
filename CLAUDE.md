# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
netwise/
├── backend/          Go API server
├── frontend/         Next.js 16 app
└── docker-compose.yml  Postgres + backend services
```

---

## Backend (Go)

### Commands

```bash
cd backend

# Run locally (requires .env)
cp .env.example .env
go run ./cmd/api

# Build
go build ./...

# Regenerate sqlc after editing internal/db/query/*.sql or migrations
sqlc generate

# Apply migrations manually (auto-runs on server start)
migrate -path internal/db/migrations -database "$DB_URL" up

# Add a Go dependency
go get <package>
go mod tidy
```

### Architecture

- **`cmd/api/main.go`** — wires config → pgxpool → stdlib adapter → sqlc Queries → Gin → routes. Also starts the daily snapshot goroutine (`cron.go`).
- **`internal/config/`** — loads env vars from `.env` via godotenv.
- **`internal/db/migrations/`** — numbered SQL migration pairs (`*.up.sql` / `*.down.sql`), applied by golang-migrate on startup.
- **`internal/db/query/`** — hand-written SQL queries consumed by sqlc. **Edit these, then run `sqlc generate`** — never edit `internal/db/sqlc/` directly.
- **`internal/db/sqlc/`** — generated code only. All NUMERIC columns come back as `string`; use `github.com/shopspring/decimal` for arithmetic.
- **`internal/handler/`** — thin Gin handlers, one file per domain. All handlers share the `Handler` struct defined in `handler.go`. Routes are registered in `handler.go` via `RegisterRoutes` (public) and `RegisterProtectedRoutes` (JWT-gated).
- **`internal/service/`** — business logic: `finnhub.go` (Finnhub HTTP client), `snapshot.go` (daily portfolio snapshot cron).
- **`internal/middleware/auth.go`** — validates JWT from `cookie["token"]`, sets `user_id` in context. Use `middleware.GetUserID(c)` in handlers.
- **`internal/util/`** — `token.go` (JWT create/parse), `crypto.go` (bcrypt, AES-256-GCM for Finnhub API key storage).

### Key invariants

- pgxpool is wrapped with `stdlib.OpenDBFromPool(pool)` so sqlc's `database/sql` interface is satisfied.
- `AES_KEY` must be exactly 32 characters.
- JWT lives in an HttpOnly cookie named `token` (30-day expiry).
- The `portfolioOwnerMiddleware()` in `handler.go` verifies portfolio ownership before every `/:id` sub-route and sets `portfolio_id` in context; retrieve it with `getPortfolioID(c)`.
- Broker rate for deposit: `target = source_IDR / broker_rate`. For withdrawal: `IDR = target * broker_rate`.
- Buy avg cost formula: `new_avg = (old_shares * old_avg + qty * price) / (old_shares + qty)`.
- Realized gain on sell: `(sell_price - avg) * qty - fee`.

---

## Frontend (Next.js 16)

The `frontend/` directory has its own `CLAUDE.md` and `AGENTS.md` that instruct agents to read the bundled Next.js 16 docs at `node_modules/next/dist/docs/` before writing code. **Always follow that instruction** — Next.js 16 has breaking changes from prior versions.

### Commands

```bash
cd frontend

# Dev server
pnpm dev

# Production build + type check
pnpm build

# Add shadcn component
pnpm dlx shadcn@latest add <component-name>

# Add a dependency
pnpm add <package>
```

### Breaking changes vs prior Next.js

- **`params` is a `Promise`** — use `const { id } = use(params)` in Client Components, `const { id } = await params` in Server Components.
- **shadcn/ui uses `@base-ui/react`** (not Radix UI). `Select.onValueChange` receives `string | null` — always guard: `onValueChange={(v) => v && setValue(v)}`.

### Architecture

- **`app/(auth)/`** — login and register pages (public, no layout wrapper).
- **`app/(dashboard)/`** — all authenticated pages behind `layout.tsx`, which calls `useProfile()` and redirects to `/login` on 401.
- **`lib/api.ts`** — Axios instance with `withCredentials: true` and a 401 interceptor that redirects to `/login`.
- **`lib/types.ts`** — shared TypeScript interfaces matching backend JSON responses.
- **`hooks/`** — TanStack Query v5 hooks, one file per domain (`use-auth`, `use-portfolios`, `use-holdings`, `use-networth`). All mutations invalidate the relevant query keys.
- **`components/dialogs/`** — Buy/Sell, Deposit/Withdraw, and Dividend dialogs (client components).
- **`components/charts/net-worth-chart.tsx`** — Recharts `AreaChart` driven by `useNetWorthSnapshots(range)`.
- **`components/providers.tsx`** — wraps the app in `QueryClientProvider`.

---

## Local development

```bash
# Copy env files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Start Postgres + backend
docker-compose up -d

# Frontend
cd frontend && pnpm dev
```

The backend auto-runs migrations on startup. Postgres is exposed on `localhost:5432` (user: `netwise`, password: `password`, db: `netwise`).
