# STRUCTURE.md — Directory Layout & Organization
_Mapped: 2026-05-25_

## Top-Level Layout

```
/ (project root)
├── app/                    # Next.js App Router — pages + API routes
│   ├── api/                # Server-side Route Handlers
│   ├── auth/               # Login/signup page
│   ├── globals.css         # Global styles + CSS custom properties
│   ├── layout.tsx          # Root layout (ThemeProvider + ConditionalLayout + Analytics)
│   ├── page.tsx            # Root redirect → /portfolio
│   └── [page]/page.tsx     # Each dashboard page (all flat, no nesting)
├── components/             # Shared React components
│   └── ui/                 # Headless/primitive UI wrappers (Dialog, Select, etc.)
├── lib/                    # Business logic, hooks, stores, utilities
│   ├── store/              # Zustand stores
│   └── supabase/           # Supabase client factories
├── public/                 # Static assets (SVGs only)
├── supabase/               # Supabase CLI config + migrations
│   └── migrations/         # SQL migration files
├── .planning/              # GSD planning context (codebase maps, specs)
│   └── codebase/           # This directory
└── [fix_*.js, refactor_*.js]  # One-off migration scripts (not part of app)
```

## App Pages (`app/`)

| Page | Route | Purpose |
|------|-------|---------|
| `portfolio/page.tsx` | `/portfolio` | Main portfolio view — positions table, add/edit |
| `overview/page.tsx` | `/overview` | Portfolio overview charts + P&L summary |
| `positions/page.tsx` | `/positions` | Positions detail with charts |
| `analytics/page.tsx` | `/analytics` | Portfolio analytics + allocation charts |
| `history/page.tsx` | `/history` | Snapshot history + performance timeline |
| `chart/page.tsx` | `/chart` | Market chart viewer |
| `scan/page.tsx` | `/scan` | AI broker screenshot scanner |
| `import/page.tsx` | `/import` | CSV/manual portfolio import |
| `risks/page.tsx` | `/risks` | Risk analysis + drawdown charts |
| `triggers/page.tsx` | `/triggers` | Price alert triggers |
| `actions/page.tsx` | `/actions` | Rebalancing action recommendations |
| `strategy/page.tsx` | `/strategy` | Investment strategy planner |
| `report/page.tsx` | `/report` | PDF/CSV report generation |
| `settings/page.tsx` | `/settings` | App settings |
| `auth/page.tsx` | `/auth` | Authentication |

## API Routes (`app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `quotes/route.ts` | GET | Stock quotes (Finnhub → Yahoo fallback) |
| `crypto/route.ts` | GET | Crypto prices (CoinGecko) |
| `bybit/route.ts` | GET | Bybit wallet balance sync |
| `analyze-portfolio/route.ts` | POST | OpenAI portfolio analysis |
| `scan-portfolio/route.ts` | POST | OpenAI vision broker screenshot scan |
| `scan-report/route.ts` | POST | OpenAI report parsing |
| `analysis/route.ts` | POST | OpenAI macro event commentary |
| `calendar/route.ts` | GET | Earnings/macro calendar |
| `macro/route.ts` | GET | FRED macroeconomic data |
| `historical/route.ts` | GET | Historical price data |
| `rates/route.ts` | GET | Exchange rates |
| `search/route.ts` | GET | Asset ticker search |
| `backfill/route.ts` | GET/POST | Portfolio history backfill |
| `restore-portfolio/route.ts` | POST | Portfolio restore from backup |

## Components (`components/`)

| Component | Purpose |
|-----------|---------|
| `Sidebar.tsx` | Navigation sidebar + mobile bottom nav + theme picker |
| `ConditionalLayout.tsx` | Wraps pages — shows/hides sidebar based on route |
| `DashboardProvider.tsx` | _(in `lib/`)_ Global data orchestration (not in components/) |
| `PageHeader.tsx` | Shared page header with title + market ticker |
| `MarketTicker.tsx` | Live scrolling market ticker bar (TV-style) |
| `LayoutEditor.tsx` | Drag/resize/pin panel layout editor |
| `AIAnalyzer.tsx` | AI analysis widget |
| `ApexChart.tsx` | ApexCharts wrapper |
| `ThemeProvider.tsx` | next-themes provider with named themes |
| `DailyAlert.tsx` | Daily market alerts component |
| `ui/Dialog.tsx` | Radix Dialog wrapper |
| `ui/DropdownMenu.tsx` | Radix DropdownMenu wrapper |
| `ui/Select.tsx` | Radix Select wrapper |
| `ui/Tooltip.tsx` | Radix Tooltip wrapper |

## Library (`lib/`)

| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript types (`StoredPosition`, `Settings`, `LiveQuote`) |
| `DashboardProvider.tsx` | Central orchestration (despite being in lib/, it's a component) |
| `useApp.ts` | Facade hook compositing auth + portfolio state |
| `useMobile.ts` | Responsive breakpoint hook |
| `usePortfolioHistory.ts` | Portfolio history derived state |
| `usePriceFlash.ts` | Price change flash animation hook |
| `marketStatus.ts` | Market open/closed status utilities |
| `tradingDay.ts` | Trading day key + Istanbul timezone baseline logic |
| `mockData.ts` | Mock data (dev/demo fallback) |
| `portfolioBackup.ts` | Portfolio backup/restore utilities |
| `store/usePortfolioStore.ts` | Positions state + localStorage persistence |
| `store/useAuthStore.ts` | Auth state + Supabase cloud sync |
| `store/useQuotesStore.ts` | Live + real quote state |
| `store/useSettingsStore.ts` | User settings state |
| `supabase/client.ts` | Browser Supabase client factory |
| `supabase/server.ts` | Server Supabase client factory |

## Naming Conventions

- **Pages**: `app/[name]/page.tsx` — default export, kebab-case directory
- **Components**: `PascalCase.tsx` — default export
- **Hooks**: `useCamelCase.ts` — named export
- **Stores**: `useCamelCaseStore.ts` — named export using `create<T>()`
- **Types**: in `lib/types.ts` or inline where used
- **API routes**: `app/api/[name]/route.ts` — named exports `GET`, `POST`
- **CSS variables**: `--bg-*`, `--text-*`, `--border`, `--accent-*` pattern
