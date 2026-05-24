# CONVENTIONS.md — Code Style & Patterns
_Mapped: 2026-05-25_

## TypeScript

- **Strict mode** enabled in `tsconfig.json` — all files must type-check
- **Target**: ES2017, module resolution: `bundler`
- **Path aliases**: `@/*` maps to project root
- `any` used in some places (mostly Recharts formatters and legacy code — see CONCERNS.md)
- Type definitions live in `lib/types.ts` for shared types; page-local types defined inline

### Common type pattern
```typescript
// Shared domain types in lib/types.ts
export type StoredPosition = {
  id: number;
  ticker: string;
  // ...
};

// Local types inline in component files
type ChartPoint = { date: string; value: number; cost: number };
```

## Component Pattern

- All pages and components marked `"use client"` (fully client-side rendering)
- **Default exports** for page components and standalone components
- **Named exports** for utility functions, hooks, stores, and shared constants exported from pages (e.g., `export const LS_DIVIDENDS`, `export function loadDividends()` from `app/overview/page.tsx`)
- No React.FC — plain function declarations with typed props

```typescript
// Page pattern
"use client";
import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/lib/useApp";
// ...

export default function OverviewPage() {
  const { positions, liveQuotes } = useApp();
  // ...
}
```

## State Management

- **Zustand** for all global state (4 stores: portfolio, auth, quotes, settings)
- **SWR** for server data fetching (quotes, crypto) with 30s refresh intervals
- **localStorage** as primary persistence for portfolio data
- **No Redux, no Context API** for state (only ThemeProvider uses Context)
- Stores use `create<T>()` with explicit interface definitions

```typescript
// Store pattern
interface PortfolioState {
  positions: StoredPosition[];
  setPositions: (positions: StoredPosition[]) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [],
  setPositions: (positions) => { set({ positions }) },
}));
```

## Data Fetching

- SWR with `fetcher` pattern — no useEffect for polling:
```typescript
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Quote request failed: ${res.status}`);
  return res.json();
};

const { data, error, isLoading } = useSWR(url, fetcher, { refreshInterval: 30000 });
```

- Direct `fetch` in API routes (no additional HTTP library)

## Event System

Custom DOM events for cross-component communication:
- `"positions-updated"` — fired when portfolio positions change
- `"portfolio-snapshot"` — fired when a snapshot is taken
- `"pagehide"` — used to trigger cloud sync on tab close

## Immutability

Zustand state updated immutably — `set({ newField })` not `state.field = x`. LocalStorage writes go through `persistPositions()` which guards against overwriting with empty arrays.

## Error Handling

- API routes: `try/catch` with `{ error: string }` JSON responses
- Stores: `try/catch` with silent fallback (swallowed errors — see CONCERNS.md)
- UI: no global error boundaries present
- Auth errors: returned as `string | null` from `signIn`/`signUp`

## Naming

| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `PageHeader`, `DashboardProvider` |
| Hooks | useXxx | `useApp`, `useMobile`, `usePortfolioHistory` |
| Stores | useXxxStore | `usePortfolioStore`, `useAuthStore` |
| Types | PascalCase | `StoredPosition`, `LiveQuote` |
| localStorage keys | kebab-case | `positions-data`, `snapshots-data` |
| CSS variables | `--category-name` | `--bg-primary`, `--text-accent` |
| Route handlers | HTTP verb | `export async function GET()` |

## Import Style

- Path alias `@/` for all cross-directory imports
- Next.js imports: `next/server`, `next/navigation`, `next/link`
- Supabase: `@/lib/supabase/client` or `@/lib/supabase/server`
- Icons: `lucide-react` (used pervasively across all pages)

## Internationalization

- UI language: **Russian** throughout (labels, messages, errors, comments)
- No i18n library — hardcoded Russian strings
- Locale-specific formatting: `toLocaleDateString("ru-RU")`, `toLocaleTimeString("ru-RU")`
- Numbers: USD formatting with `toLocaleString("en-US")` for amounts

## Chart Libraries

Two chart libraries in use:
1. **Recharts** — used on most pages (area, bar, pie, scatter charts)
2. **ApexCharts** (`react-apexcharts`) — used for candlestick/OHLC charts (`app/chart/page.tsx`)

Recharts formatters use `(v: any)` pattern (Recharts types limitation):
```tsx
<Tooltip formatter={(v: any) => [`${v}%`]} />
```
