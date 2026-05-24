# INTEGRATIONS.md — External Services & APIs
_Mapped: 2026-05-25_

## Authentication & Database

### Supabase
- **Auth**: Email/password via `@supabase/ssr` + `createServerClient` in `middleware.ts`
- **Middleware**: `middleware.ts` — protects all `/api/*` routes, returns 401 if no session
- **Client**: `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server)
- **Cloud sync**: User portfolio data stored in Supabase; sync via `useAuthStore.syncToCloud()`
- **Project ref**: `mkrzmftldtmurzlzsxeh`
- **Migrations**: `supabase/migrations/20260509092022_remote_schema.sql`

## Market Data Providers

### Finnhub (stocks — primary)
- **Route**: `app/api/quotes/route.ts`
- **Env**: `FINNHUB_API_KEY`
- **Endpoint**: `https://finnhub.io/api/v1/quote?symbol=...`
- **Usage**: Primary stock quote provider; falls back to Yahoo Finance if unavailable

### Yahoo Finance (stocks — fallback)
- **Route**: `app/api/quotes/route.ts`
- **No API key required**
- **Endpoint**: `https://query1.finance.yahoo.com/v8/finance/chart/...` (+ query2 fallback)
- **Usage**: Secondary stock quotes when Finnhub unavailable or returns no data

### CoinGecko (crypto quotes)
- **Route**: `app/api/crypto/route.ts`
- **No API key required** (free tier)
- **Endpoint**: `https://api.coingecko.com/api/v3/simple/price`
- **Usage**: Real-time crypto prices; 50-coin hardcoded ID mapping in route file

### TwelveData (market data)
- **Route**: Referenced in `next.config.ts` CSP (`https://api.twelvedata.com`)
- **Env**: `TWELVE_DATA_API_KEY`

### Bybit Exchange (crypto broker sync)
- **Route**: `app/api/bybit/route.ts`
- **Env**: `BYBIT_API_KEY`, `BYBIT_API_SECRET`
- **Endpoint**: `https://api.bybit.com/v5/account/wallet-balance`
- **Auth**: HMAC-SHA256 signature (`crypto.createHmac`)
- **Logic**: Tries UNIFIED account type first, falls back to SPOT on failure

## AI / LLM Services

### OpenAI (primary AI)
- **Routes**: `app/api/analyze-portfolio/route.ts`, `app/api/analysis/route.ts`, `app/api/scan-portfolio/route.ts`, `app/api/scan-report/route.ts`
- **Env**: `OPENAI_API_KEY`
- **Models used**: `gpt-4o-mini` (analysis), vision model for broker screenshot scan
- **Usage**: Portfolio analysis, macro event commentary, broker screenshot parsing (vision)

### Anthropic Claude SDK
- **Package**: `@anthropic-ai/sdk` ^0.92.0 installed
- **Usage**: Package present, not actively called in mapped routes (may be planned)

## Macro / Calendar Data

### FRED (Federal Reserve Economic Data)
- **Route**: `app/api/macro/route.ts`
- **No API key** — uses FRED CSV export endpoint
- **Usage**: Macroeconomic indicators

### Yahoo Finance Calendar
- **Route**: `app/api/calendar/route.ts`
- **Usage**: Earnings calendar, economic events

## Analytics & Monitoring

### Vercel Analytics
- **Package**: `@vercel/analytics/next`
- **Integration**: `<Analytics />` in `app/layout.tsx`
- **Usage**: Page views, user flow tracking

## Deployment

### Vercel
- **Config**: `vercel.json`, `.vercel/project.json`
- **Project**: `my-portfolio` (team: `grame90s-projects`)
- **OIDC**: `VERCEL_OIDC_TOKEN` in `.env.local` (auto-injected by Vercel CLI)

## Content Security Policy (allowed origins)

Configured in `next.config.ts`:
- `https://*.supabase.co` + `wss://*.supabase.co` — Supabase realtime
- `https://api.coingecko.com` — crypto prices
- `https://query1.finance.yahoo.com` + `query2` — Yahoo Finance
- `https://api.twelvedata.com` — TwelveData
- `https://finnhub.io` — Finnhub
- `https://api.bybit.com` — Bybit
