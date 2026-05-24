# ARCHITECTURE.md — System Architecture
_Mapped: 2026-05-25_

## Pattern

**Next.js App Router monolith** with client-heavy rendering. No separate backend service — API routes in the same Next.js project. All business logic lives client-side with Zustand stores; server-side API routes act as thin proxy/orchestration layer.

## Layers

```
Browser (Client)
  └── React pages ("use client")
       └── Zustand stores (global state)
       └── SWR hooks (data fetching + polling)
       └── DashboardProvider (orchestration hub)
            └── /api/* (Next.js Route Handlers)
                 └── Supabase (auth + cloud storage)
                 └── Finnhub / Yahoo / CoinGecko (market data)
                 └── OpenAI (AI analysis)
                 └── Bybit (crypto broker)
```

## Core Data Flow

1. **Auth**: `middleware.ts` protects all `/api/*` routes via Supabase JWT check
2. **Positions**: Stored in `localStorage` via `usePortfolioStore` (Zustand); synced to Supabase via `useAuthStore.syncToCloud()` for logged-in users
3. **Quotes**: `DashboardProvider` fetches stock quotes from `/api/quotes` and crypto from `/api/crypto` via SWR (30s refresh interval)
4. **Simulated live prices**: `DashboardProvider` runs a 300ms interval simulating micro-price movements (±0.1% drift) during market hours for visual effect
5. **AI features**: Pages POST to `/api/analyze-portfolio`, `/api/scan-portfolio`, `/api/scan-report` which proxy to OpenAI

## Key Abstractions

### `DashboardProvider` (`lib/DashboardProvider.tsx`)
Central orchestration component wrapped around all dashboard pages. Manages:
- Auth lifecycle (Supabase session + auth state changes)
- Periodic cloud sync (60s interval)
- SWR polling for quotes
- Simulated live price micro-movements
- Daily auto-snapshot logic (localStorage + event dispatch)
- Istanbul 06:00 day-start baseline tracking

### Zustand Stores (`lib/store/`)
| Store | Purpose |
|-------|---------|
| `usePortfolioStore` | Portfolio positions with localStorage persistence and backup |
| `useAuthStore` | Supabase auth + cloud sync to/from Supabase |
| `useQuotesStore` | Live quotes, real quotes anchor, quote status |
| `useSettingsStore` | User preferences (portfolio name, risk level, target amounts) |

### `useApp` hook (`lib/useApp.ts`)
Facade hook — composites auth state + portfolio state into a single interface used by most pages.

### API Routes (`app/api/`)
Thin server-side proxies. Pattern:
- Validate env keys → call external API → transform response → return JSON
- No database queries in route handlers (Supabase used only for auth via middleware)
- Error responses use consistent `{ error: string }` shape

## State Persistence Strategy

| Data | Storage |
|------|---------|
| Portfolio positions | `localStorage` (key: `positions-data`) |
| Portfolio backup | `localStorage` (key: `positions-data-backup`) |
| Chart history | `localStorage` (key: `portfolio-chart-history`) |
| Daily snapshots | `localStorage` (key: `snapshots-data`) |
| Dividends | `localStorage` (key: `dividends-received`) |
| Cloud backup | Supabase (synced when user is logged in) |
| Settings | `localStorage` (Zustand `useSettingsStore`) |

## Auth Architecture

- **Provider**: Supabase (email + password)
- **Session**: Cookie-based via `@supabase/ssr`
- **Protection**: `middleware.ts` checks `supabase.auth.getUser()` on all `/api/*` — returns 401 if no valid session
- **Client auth**: `lib/supabase/client.ts` used in stores and `DashboardProvider`
- **Public pages**: `/auth` (login/signup) — not protected by middleware

## Theme System

- `ThemeProvider` (`components/ThemeProvider.tsx`) using `next-themes`
- Named themes: `purple`, `blue`, `green`, `amber` + `light-*` variants
- Applied via CSS custom properties in `app/globals.css`

## Routing

All pages under `app/` using Next.js App Router. No dynamic routes — all pages are static slugs:
`/portfolio`, `/overview`, `/positions`, `/scan`, `/chart`, `/analytics`, `/history`, `/import`, `/risks`, `/triggers`, `/actions`, `/strategy`, `/report`, `/settings`, `/auth`

`ConditionalLayout` (`components/ConditionalLayout.tsx`) toggles sidebar visibility — hidden on `/auth`.
