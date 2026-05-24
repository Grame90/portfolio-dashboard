# CONCERNS.md — Technical Debt & Issues
_Mapped: 2026-05-25_

## Critical Issues

### 1. Credentials in `.env.local` committed to repo history
- **File**: `.env.local`
- **Issue**: `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a `VERCEL_OIDC_TOKEN`. If this file is not in `.gitignore` or was ever committed, credentials could be leaked.
- **Severity**: CRITICAL

### 2. `console.log` / `console.error` in production API routes
- **Files**: `app/api/bybit/route.ts:26,48`, `lib/store/usePortfolioStore.ts:52`, many page files
- **Issue**: Debug logging ships to production; may expose internal info
- **Severity**: HIGH

### 3. `any` type usage throughout
- **Files**: `app/portfolio/page.tsx`, `app/positions/page.tsx`, `app/scan/page.tsx`, `app/actions/page.tsx`, `app/risks/page.tsx`, others
- **Issue**: Bypasses TypeScript type safety; masks potential runtime errors
- **Severity**: MEDIUM (mostly in Recharts formatters — low risk; some in business logic — higher risk)

## High Severity

### 4. No test coverage
- **Issue**: Zero automated tests. Financial application with localStorage as primary storage — no tests for data integrity guards, sync logic, or UI flows.
- **Files**: entire codebase
- **Severity**: HIGH

### 5. Massively oversized page files
- **Files**:
  - `app/portfolio/page.tsx` — **1,781 lines** (2× over 800-line limit)
  - `app/positions/page.tsx` — **1,635 lines**
  - `app/history/page.tsx` — **860 lines**
  - `app/overview/page.tsx` — **1,119 lines**
- **Issue**: Single files contain all logic, state, rendering, and helpers. Impossible to test in isolation. Hard to maintain.
- **Severity**: HIGH

### 6. Silent error swallowing in stores
- **Files**: `lib/store/usePortfolioStore.ts:74-75`, `lib/store/useAuthStore.ts` multiple catch blocks
- **Issue**: `try {} catch {}` with empty bodies — errors are silently lost. If localStorage write fails, the user has no feedback.
```typescript
// Example from usePortfolioStore.ts:
clearPositions: () => {
  try {
    // ...
  } catch {} // <-- silent failure
},
```
- **Severity**: HIGH

### 7. No error boundaries in UI
- **Issue**: No React Error Boundary components anywhere. A crash in one component propagates to the full page.
- **Severity**: HIGH (financial dashboard — partial crashes are common)

## Medium Severity

### 8. Shared business logic exported from page files
- **Files**: `app/overview/page.tsx` exports `LS_DIVIDENDS`, `loadDividends()`, `saveDividends()`, `DIVIDEND_YIELDS`, `ReceivedDividend` type
- **Issue**: Other pages import from `app/overview/page.tsx` — creates a tight coupling between page component and reusable utilities. Moving page → breaks importers.
- **Severity**: MEDIUM

### 9. Hardcoded financial constants
- **Files**: `app/overview/page.tsx:16-30` — `DIVIDEND_YIELDS` record with hardcoded yield percentages for 50+ tickers
- **Issue**: Dividend yields change quarterly; hardcoded values become stale silently.
- **Severity**: MEDIUM

### 10. One-off fix/refactor scripts in repo root
- **Files**: `fix_page_header_bybit.js`, `fix_portfolio.js`, `fix_positions.js`, `fix_report.js`, `fix_sidebar.js`, `fix_sidebar_import.js`, `refactor_portfolio.js`, `refactor_positions.js`, `refactor_report.js`
- **Issue**: 9 migration scripts at project root with no documentation. Unclear if they need to run, have already run, or are still needed.
- **Severity**: MEDIUM (cleanup needed)

### 11. CoinGecko ID mapping hardcoded in API route
- **File**: `app/api/crypto/route.ts` — 50+ hardcoded `CG_IDS` mappings
- **Issue**: Any new crypto ticker requires code change. If CoinGecko ID changes, silent failure (no quote returned).
- **Severity**: MEDIUM

### 12. Simulated price noise in production
- **File**: `lib/DashboardProvider.tsx:122-148`
- **Issue**: 300ms interval adds random ±0.1% noise to prices during market hours. This is a visual effect that could confuse users comparing dashboard prices to their broker.
- **Severity**: MEDIUM

### 13. `ru-РУ` locale typo
- **File**: `lib/DashboardProvider.tsx:237`
- **Issue**: `"ru-РУ"` (Cyrillic РУ) instead of `"ru-RU"` (Latin). Falls back to default locale silently.
- **Severity**: MEDIUM (formatting bug)

## Low Severity

### 14. No loading states for initial auth
- **Issue**: `DashboardProvider` has a 4000ms timeout fallback for auth loading (`setTimeout(() => setAuthLoading(false), 4000)`). Pages may flash incorrect state during this window.
- **Severity**: LOW

### 15. `supabase/ak_data.json` and `user_data.json` in repo
- **Files**: `supabase/ak_data.json`, `supabase/user_data.json`
- **Issue**: Unclear if these contain real user data or test data. Should be audited and gitignored if sensitive.
- **Severity**: LOW–MEDIUM (pending audit)

### 16. `atletikpro-db.json` at project root
- **File**: `atletikpro-db.json`
- **Issue**: Appears to be data from a different project (AtletikPro). Leftover artifact, likely can be deleted.
- **Severity**: LOW

## Performance

### 17. All pages use `"use client"` — no server rendering
- **Issue**: Every page is fully client-side. No RSC, no streaming, no static generation. Initial page load requires full JS bundle before any content renders.
- **Severity**: LOW (acceptable for a dashboard app behind auth)

### 18. No bundle analysis
- **Issue**: No `@next/bundle-analyzer` configured. Bundle size unknown. Two chart libraries (Recharts + ApexCharts) likely add significant weight.
- **Severity**: LOW
