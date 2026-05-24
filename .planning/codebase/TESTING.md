# TESTING.md — Test Structure & Practices
_Mapped: 2026-05-25_

## Current State: NO TESTS

The codebase has **zero test files**. No test framework, no test runner, no CI testing pipeline was found.

- No `jest.config.*` file
- No `vitest.config.*` file
- No `playwright.config.*` file
- No `*.test.ts` / `*.test.tsx` / `*.spec.ts` / `*.spec.tsx` files
- No `__tests__/` directories
- No `test` script in `package.json`

## Coverage

**0%** — no automated test coverage of any kind.

## Manual / Ad-hoc Testing

Based on git history and project structure, testing appears to be done entirely manually through the browser. The project has:
- Several `fix_*.js` and `refactor_*.js` scripts at the root — one-off data migration scripts run manually
- A `.gstack/browse-audit.jsonl` and related files suggesting manual browser-based QA via gstack/browser tooling

## What Should Be Tested (Priority Order)

Given the risk profile of the codebase (financial data, localStorage persistence, cloud sync), these are the highest-priority areas if tests are added:

### 1. Unit Tests (highest value)
- `lib/store/usePortfolioStore.ts` — `persistPositions()` guard logic (refuses empty overwrite)
- `lib/store/useAuthStore.ts` — `newerLocalData()` comparison logic
- `lib/tradingDay.ts` — Istanbul timezone day-start logic
- `lib/portfolioBackup.ts` — backup/restore utilities
- `app/api/quotes/route.ts` — Finnhub → Yahoo fallback logic
- `app/api/bybit/route.ts` — UNIFIED → SPOT fallback, HMAC signature

### 2. Integration Tests
- Auth flow: login → cloud sync → logout → localStorage fallback
- Portfolio sync: local edit → Supabase write → reload → correct state
- Quote fetching: mock API responses → correct store update

### 3. E2E Tests (Playwright recommended)
- Add position → appears in portfolio → reflected in overview charts
- AI scan: upload screenshot → positions extracted → confirm import
- Settings change → persisted across page reload
- Auth: login → data loads from cloud

## Recommended Setup

```bash
# Add Playwright for E2E (matches project's Next.js + browser-heavy nature)
npm install -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:3000' },
});
```

## Notes

- The project uses `swr` for data fetching — test with `msw` (Mock Service Worker) for API mocking
- localStorage state should be reset between tests
- Supabase can be mocked with `supabase-js` client mock or test environment
