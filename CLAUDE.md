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
- **`internal/service/`** — business logic: `yahoo.go` (Yahoo Finance API for stock/crypto search and prices, no API key required), `snapshot.go` (daily portfolio snapshot cron), `forex.go` (free forex rates via `open.er-api.com`, no API key required), `cache.go` (in-process price cache 60s TTL, forex cache 1h TTL).
- **`internal/middleware/auth.go`** — validates JWT from `cookie["token"]`, sets `user_id` in context. Use `middleware.GetUserID(c)` in handlers.
- **`internal/util/`** — `token.go` (JWT create/parse), `crypto.go` (bcrypt, AES-256-GCM for API key storage).

### Handler conventions

- **Response helpers** in `internal/handler/helpers.go`: `respondNotFound(c, "resource")` → 404, `respondError(c, code, "message")` → custom code.
- **Status codes**: validation failure → 400 with validator message; create → 201; delete → 204; read/update → 200.
- **Partial updates**: optional fields use `*string` + `sql.NullString` wrapping (e.g., `UpdatePortfolio`, `UpdateUser`).
- **Enum validation**: uses Gin `binding:"oneof=VALUE1 VALUE2"` constraint (e.g., wallet transaction type).
- **Utility functions**: `paramInt64(c, "param")` extracts int64 URL params; `queryInt(c, "key", default)` extracts query params; `decimalFromString(s)` parses strings to decimal (returns 0 on error, silently).

### Key invariants

- pgxpool is wrapped with `stdlib.OpenDBFromPool(pool)` so sqlc's `database/sql` interface is satisfied.
- `AES_KEY` must be exactly 32 characters.
- JWT lives in an HttpOnly cookie named `token` (30-day expiry). **Production gap**: `Secure` flag is hardcoded to `false` in `auth.go` — must be changed before HTTPS deployment.
- The `portfolioOwnerMiddleware()` in `handler.go` verifies portfolio ownership before every `/:id` sub-route and sets `portfolio_id` in context; retrieve it with `getPortfolioID(c)`.
- `walletOwnerMiddleware()` does the same for wallets, setting `wallet_id` in context; retrieve with `getWalletID(c)`.
- Wallet balance has **no stored column** — it is computed on demand via `GetWalletBalance` (sums wallet_transactions). Never try to read a balance field from the `wallets` table directly.
- Wallet transaction types: `INCOME`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `PORTFOLIO_DEPOSIT`, `PORTFOLIO_WITHDRAWAL`.
- **Wallet category system**: `"Initial Balance"` is a system-seeded category (`is_system=true`), looked up by name in `SetInitialBalance`. System categories cannot be deleted (enforced in `DeleteWalletCategory`).
- Broker rate for deposit: `target = source_IDR / broker_rate`. For withdrawal: `IDR = target * broker_rate`.
- Buy avg cost formula: `new_avg = (old_shares * old_avg + qty * price) / (old_shares + qty)`.
- Realized gain on sell: `(sell_price - avg) * qty - fee`.
- **Stock symbol routing**: `IsIDRNativeSymbol(symbol)` returns true for `.JK` (IDX) and `-IDR` (crypto) suffixes. `-IDR` crypto (e.g., `BTC-IDR`) fetches `BTC-USD` then multiplies by USD→IDR forex rate. Adding a new market type requires updating `IsIDRNativeSymbol` and both callers: `livePrice()` in `holding.go` and the price-fetch goroutine in `networth.go`. `SearchStocks?market=US` → `SearchUSStocks` (EQUITY only); `?market=ID` → `SearchIDRAssets` (`.JK` + `-IDR` crypto).
- **Snapshot cron** runs at midnight UTC; catches up on startup if yesterday's snapshot is missing. Historical backfill uses **current** holdings (not historical quantities) — see TODO in `snapshot.go`. Wallet snapshots compute `balance_usd` via `GetFreeForexRate("IDR","USD")` fetched once per run.
- **CORS**: custom middleware in `cmd/api/main.go`; `ALLOWED_ORIGINS` env var is a single origin string (not a comma-separated list).
- **Known limitation**: multi-step operations (BuyStock, SellStock, WalletToPortfolio) are NOT wrapped in a DB transaction — partial failures can leave data inconsistent.

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
- **`lib/query-client.ts`** — exports the `QueryClient` instance used by `providers.tsx`.
- **`context/ui-settings.tsx`** — **Critical**: `UISettingsProvider` exposes `darkMode`, `toggleDarkMode`, `unseen`, `toggleUnseen` hooks (both persisted to `localStorage`). The `useAmount()` hook returns a currency formatter; when `unseen` is active it returns `"••••"` instead of the value. **Every monetary amount in the UI must be rendered through `useAmount()`** (or aliased as `fmtAmt`). Dark mode works by toggling the `dark` class on `<html>`; `app/layout.tsx` injects an inline `<script>` to prevent FOUC.
- **`hooks/`** — TanStack Query v5 hooks, one file per domain (`use-auth`, `use-portfolios`, `use-holdings`, `use-networth`, `use-wallets`). All mutations invalidate the relevant query keys. **Exception**: `useHoldings` has `refetchInterval: 60_000` to poll live prices every 60 seconds.
- **`components/dialogs/`** — Buy/Sell, Deposit/Withdraw, and Dividend dialogs (client components). Error handling follows a uniform pattern: catch as `{ response?: { data?: { error?: string } } }` and display inline in `<p className="text-sm text-destructive">`.
- **`components/charts/net-worth-chart.tsx`** — Recharts `AreaChart` driven by `useNetWorthSnapshots(range)`. Appends a synthetic "Today" point client-side (via `useMemo`) when the most recent snapshot date does not match today. **Known limitation**: `useMultiPortfolioSnapshots` hardcodes exactly 10 hook calls (React rules); users with >10 portfolios silently lose chart data.
- **`components/providers.tsx`** — wraps the app in `QueryClientProvider` (uses the instance from `lib/query-client.ts`).
- **`app/(dashboard)/wallets/`** — wallet list, create, and detail pages. Wallet detail page (`[id]/page.tsx`) shows balance, transactions, and allows income/expense/transfer operations.

### API proxy

- **`next.config.ts`** rewrites `/api/v1/:path*` → `BACKEND_URL/api/v1/:path*` (defaults to `http://localhost:8080`). The frontend never makes cross-origin requests; `withCredentials: true` works because the cookie domain is always the Next.js origin.

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

---

## Linting and testing

- **Backend**: No linter configuration (no `.golangci.yml`). One `//nolint:gosec` suppression in `forex.go`.
- **Frontend**: ESLint v9 flat config via `eslint.config.mjs` using `eslint-config-next`. Run with `pnpm lint`. No Prettier configuration.
- **Testing**: No tests exist in the project (no `*_test.go` or `.test.ts` files).
