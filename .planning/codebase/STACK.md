# STACK.md — Technology Stack
_Mapped: 2026-05-25_

## Runtime & Language

| Item | Value |
|------|-------|
| Language | TypeScript 5.x (strict mode) |
| Runtime | Node.js (Next.js server) / Browser |
| Framework | Next.js ^16.2.6 (App Router) |
| React | 19.2.4 |
| Package manager | npm (package-lock.json present) |

## Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.2.6 | Full-stack framework with App Router |
| `react` / `react-dom` | 19.2.4 | UI rendering |
| `tailwindcss` | ^4 | Utility CSS (PostCSS via `@tailwindcss/postcss`) |
| `lucide-react` | ^1.14.0 | Icon set |
| `next-themes` | ^0.4.6 | Theme switching (dark/light/named) |
| `recharts` | ^3.8.1 | React-native charts |
| `apexcharts` + `react-apexcharts` | ^5/^2 | Advanced charting |
| `@radix-ui/react-*` | various | Headless UI primitives (Dialog, Dropdown, Select, Tabs, Tooltip) |
| `swr` | ^2.4.1 | Data fetching + caching |
| `zustand` | ^5.0.12 | Global client-side state management |

## Backend / API

| Library | Purpose |
|---------|---------|
| Next.js Route Handlers (`app/api/*/route.ts`) | REST API endpoints |
| `@supabase/supabase-js` ^2.105.4 | Database + auth client |
| `@supabase/ssr` ^0.10.3 | SSR-safe Supabase session handling |
| `openai` ^6.36.0 | OpenAI GPT-4o-mini for AI analysis |
| `@anthropic-ai/sdk` ^0.92.0 | Anthropic Claude SDK (present but usage TBD) |
| `pdf-parse` ^1.1.1 | PDF parsing for report imports |

## Dev Tools

| Tool | Config File |
|------|------------|
| TypeScript | `tsconfig.json` (strict, ES2017 target, bundler resolution) |
| ESLint | `eslint.config.mjs` (next/core-web-vitals) |
| PostCSS / Tailwind v4 | `postcss.config.mjs` |
| Vercel deployment | `vercel.json`, `.vercel/project.json` |
| Vercel Analytics | `@vercel/analytics` ^2.0.1 |

## CSS Architecture

- Tailwind v4 utility classes
- CSS custom properties for theming (`--bg-primary`, `--text-primary`, `--border`, `--bg-card` etc.)
- Global styles in `app/globals.css`
- Multi-theme support via `ThemeProvider` (purple/blue/green/amber × dark/light variants)

## Build & Deploy

- `next dev` — development server
- `next build` + `next start` — production
- Deployed on **Vercel** (Hobby plan, project: `my-portfolio`)
- Supabase project: `mkrzmftldtmurzlzsxeh` (linked via CLI)

## Environment Variables Required

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role (admin ops) |
| `OPENAI_API_KEY` | Server | GPT-4o-mini analysis |
| `FINNHUB_API_KEY` | Server | Stock quote provider |
| `BYBIT_API_KEY` + `BYBIT_API_SECRET` | Server | Bybit crypto exchange |
| `TWELVE_DATA_API_KEY` | Server | TwelveData market data |
