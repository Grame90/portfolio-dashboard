# Журнал проекта · Portfolio Classic

> Открой этот файл когда садишься работать — увидишь сразу: где мы, что работает, что чинить дальше.
>
> Последнее обновление: **2026-05-29**

---

## ⚡ Быстро

| | |
|---|---|
| **Прод** | https://grame.skin |
| **Локал** | http://localhost:3005 (`npx next dev -p 3005`) |
| **Деплой** | `vercel --prod --yes` (linked на проект `dashboard`) |
| **Git ветка с нашим кодом** | `vercel-prod` (на GitHub) · локально `main` |
| **Stack** | Next.js 16.2.4 (Turbopack) · Supabase auth · Vercel · TypeScript |

---

## ✅ Сделано в последней серии работ (май 2026)

### Дневник
- Полная переписка с нуля — 4 вкладки: **Журнал / Аналитика / Excel / Настройки**
- Авто-снапшоты из `/positions` каждую минуту (`auto-snapshot.ts`)
- Стамбульский день начинается в **03:00** (`istanbul-time.ts`)
- LIVE-строка сегодня (зелёная, не редактируется) + замороженные прошлые (редактируются)
- Колонки: Total, **Δ за день**, Чистая прибыль, Доходность %, Сверх %, Инвестировано, Переводы, Комент
- Инлайн-формулы в ячейках: `=12000+500`, `=A1*0.1` (parser в `excel-formula.ts`)
- Бэкфилл из истории Yahoo + on-demand FX (`backfill.ts`, `fetchHistoricalFxMap`)
- Авто-определение валюты брокера по тикерам (`broker-currency.ts`)
- Авто-подтяжка FX курсов для записей без `entry.rates`
- Storage v2 с миграцией (стирает старые v1 ключи на первом mount)

### Excel-вкладка
- Свободная таблица: колонки/строки можно добавлять/удалять/переименовывать
- Брокер-маппинг колонок → нижняя строка LIVE из `/positions`
- **«Авто-сегодня»** — каждый день новая строка сверху, формулы копируются со сдвигом ссылок
- Excel-style формулы с A1-ссылками, диапазонами, функциями SUM/AVG/MIN/MAX/COUNT/IF
- Импорт `.xlsx/.csv` файлов
- Google Sheets двусторонняя синхронизация (OAuth + публичный CSV через `/api/sheets-public` прокси)
- Iframe embed (`/preview`) для просмотра нативного Google листа
- Кнопки: **Очистить таблицу**, **Перевернуть строки**

### Кризис-Алерт badge (`components/DailyAlert.tsx`)
- Hover-попап с 6 индикаторами + countdown до следующей проверки
- Кнопка **↻ Обновить** — дёргает SWR-кэши + перечитывает позиции

### Portfolio / Quotes
- Исправлен баг расчёта **«Изменение за день»** для QQQ и всех ETF: `previousClose` теперь берётся из `closes[-2]`, а не из глючного Yahoo `chartPreviousClose` (давал +4% вместо −0.1%)
- Индикатор «рынок закрыт» + фьючерсные цены для commodity ETF (SLV→SI=F и т.д.) — задумано, не реализовано

### History page
- Исправлен бесконечный цикл `useEffect` от нестабильной ссылки `realPositions`

### Чистка
- Удалены `lib/diary/aggregate.ts` + `lib/diary/grouping.ts` (мёртвый код, 495 строк)
- Удалены `lib/usePriceFlash.ts` + `app/chart2/` (никто не импортирует)
- Удалена 625 веток `ralph-backup-loop-*`
- Удалён лишний Vercel-проект `portfolio-classic`
- Repo size: **4.9 ГБ → 84 МБ** (`git filter-repo` снёс `.next/` и большие бинарники из истории)
- `.gitignore` дополнен: `.next/`, `node_modules/`, `*.tsbuildinfo`, `.vercel/`, `.DS_Store`

---

## 🎯 TODO — что осталось сделать

### Приоритет HIGH

- [ ] **Разобрать 2-3 коммита из старого remote `main`** перед force-push:
  - `c4ce13f9` Isolate cloud sync to production only, protect against data wipe
  - `17e5f627` Add CDN caching to quotes/crypto/calendar API routes
  - `.github/workflows/deploy.yml` (Netlify CI — может не нужно)
- [ ] **После разбора** — force-push `vercel-prod → main` чтобы GitHub `main` и наш код смотрели в одну сторону

### Приоритет MED

- [ ] **Объединить Журнал ↔ Excel** или явно разделить use-cases. Сейчас они параллельные миры с пересекающимися фичами (балансы брокеров, формулы, авто-сегодня).
- [ ] **Google Sheets refresh-token flow** — сейчас токен живёт ~58 мин, после надо снова жать «Подключить Google»
- [ ] **Индикатор «рынок открыт/закрыт»** в портфеле + futures-цена для commodity ETF (задизайнено, не сделано)
- [ ] **`previousClose` фикс в других путях** — починил только `/api/quotes`. Проверить `/api/historical` и `useApp.dailyChangePct` на тот же баг.

### Приоритет LOW

- [ ] Прибить второй dev-сервер `fao` на порту 3000 (если не работаешь над ним)
- [ ] **«Остаток после того как»** колонка в Журнале — пользователь хотел, но не описал формулу
- [ ] Вернуть **группировку Год / Месяц / Неделя** в Журнал (модуль удалён, но логика тривиально воссоздаётся)
- [ ] Анимация спина на кнопке «↻ Обновить» в Кризис-Алерте — добавлен `@keyframes spin` inline, можно вынести в global CSS

---

## ⚠️ Известные quirks

- **Storage v2 → wipe v1**: при первом открытии `/diary` после деплоя — старые данные дневника стираются. Это намеренно (фикс «не получалось редактировать»), но если когда-то нужна другая миграция — придётся писать руками.
- **Google Sheets `pullPublicCsv`** работает только если лист **«Anyone with link can view»**. Иначе → ошибка.
- **Google Sheets iframe** работает через `/preview` URL — это **read-only**. Edit-iframe Google блокирует через X-Frame-Options.
- **Локальная `git history`** разошлась с remote `main`. Сейчас наш код только на ветке `vercel-prod` в GitHub. Remote `main` имеет старую Netlify-CI историю с daily backups.
- **Дев-сервер fao** на 3000 крутится фоном (другой проект пользователя). На нашу работу не влияет, просто ест RAM.

---

## 🛠 Полезные команды

```bash
# Запустить dev
npx next dev -p 3005

# Деплой на grame.skin (если .vercel/project.json указывает на dashboard)
vercel --prod --yes

# Проверить какой проект в Vercel сейчас залинкован
cat .vercel/project.json

# Переключиться на нужный проект
vercel link --project=dashboard --yes

# TypeScript-check
npx tsc --noEmit --pretty false

# Push в GitHub (наша ветка)
git push origin main:vercel-prod

# Если порт 3005 занят
lsof -ti:3005 | xargs kill
```

---

## 🔗 Что куда смотрит

```
Локально     →  app/diary/page.tsx (~430 строк)
                ↓ split на:
                  components/diary/JournalView.tsx
                  components/diary/AnalyticsView.tsx
                  components/diary/ExcelView.tsx
                  components/diary/SettingsView.tsx
                  components/diary/EditableCells.tsx
                ↓ data layer:
                  lib/diary/auto-snapshot.ts        ← LIVE today + freeze
                  lib/diary/istanbul-time.ts        ← 03:00 rollover
                  lib/diary/compute.ts              ← Total, Plan, %
                  lib/diary/backfill.ts             ← historical Yahoo
                  lib/diary/google-sheets.ts        ← OAuth + Sheets API
                  lib/diary/excel-grid.ts           ← Excel-вкладка
                  lib/diary/excel-formula.ts        ← A1 parser
                  lib/diary/storage.ts              ← localStorage v2
                  lib/diary/types.ts                ← shared types

GitHub       →  ветка vercel-prod = наш код
                ветка main = старая Netlify-история (не трогать)

Vercel       →  проект dashboard → grame.skin
                (раньше был портfolio-classic, удалили)

Supabase     →  auth + cloud sync (DashboardProvider.tsx)
```

---

## 📝 Как обновлять этот файл

Это **ручной журнал** — пиши в нём когда делаешь что-то важное. Не путать с автоматическим `PROGRESS.md` (он генерируется Stop-хуком и содержит последние 30 строк болтовни).

Когда добавляешь раздел «Сделано» — переноси соответствующие TODO в «Сделано». Когда придумываешь новую идею — добавляй в TODO с приоритетом.
