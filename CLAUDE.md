# CLAUDE.md

## Пользователь
- Имя: Алихан
- Общение на русском.

## Проект
Внутренняя система бронирования для OFFICE 2020 (VIP-заведение, Алматы) — аналог Altegio. Приложение в `booking/`. 5 цельных объектов, бронь 24/7, таймзона Asia/Almaty, выходные = пт/сб, полуоткрытые интервалы `[start, end)`.

- Стек: Next.js 14.2 (App Router, TS) + Prisma 6 + PostgreSQL + Tailwind + next-intl (ru/kk) + Auth.js 5 + Zod + date-fns.
- Антиовербукинг на уровне БД: exclusion constraint `btree_gist` (миграция `booking_no_overlap`) + проверка в `lib/bookings.ts`.
- Публичная страница заявок без логина: `/ru/book` и `/kk/book` (ссылка клиентам: `http://10.10.2.6:3000/ru/book`). Остальное — за логином, `/settings/*` только для ADMIN.
- Деплой-гайд с нуля: `booking/deploy.md`.

## Асату (второе приложение, `asatu/` — ОТДЕЛЬНЫЙ git-репозиторий)
`asatu/` — самостоятельный репозиторий (`git@github.com:alikhanneprogrammist/asatu.git`), в репо office2020 игнорируется через корневой .gitignore. Копия booking для ресторана «Асату» (3 этажа). Отличия: объекты = столы с полем `Resource.floor` (3 этажа × 8 столов в сиде), календарь — шахматка «стол × дата» (`components/calendar/TableGrid.tsx` + `TableBookingDialog.tsx`; бронь = интервал [время прихода, следующие 00:00) — антиовербукинг даёт «один стол — одна бронь в день», почасового календаря нет), тарифы не используются (CUSTOM, суммы вручную, `minBookingHours=0`). Docker из `asatu/`: app **:3001**, db **127.0.0.1:5433**; секреты в `asatu/.env` (админ `+77010000001` / `asatu2026`). Команды те же, что у booking, но из `asatu/`.

## Окружение (важно)
- Ubuntu 22.04, **без sudo**. Docker установлен и доступен.
- Node 20.18.1 лежит в `~/.local/node`, НЕ в PATH. Каждая Bash-команда с node/npm/npx/tsx: `export PATH="$HOME/.local/node/bin:$PATH"`.
- Приложение работает в Docker: `docker compose up -d` **из `booking/`** (app :3000, db postgres:16 :5432).
- Локальный userspace-Postgres (`~/.local/pgsql/pgctl.sh`) существует, но обычно ОСТАНОВЛЕН — порт 5432 занят Docker-БД. Не запускать оба сразу.
- Все секреты в `booking/.env` (gitignored). Демо-админ: телефон `+77010000001`, пароль `office2020`.
- `gh` не установлен; git remote: `git@github.com:alikhanneprogrammist/booking.git` (корень репо — `/home/adminoffice/office2020`).

## Команды (из booking/, с export PATH)
- `npm run build` — прод-сборка; `npx tsc --noEmit` — типы.
- `npm run db:migrate` (deploy) / `db:migrate:dev` / `db:seed` (ВАЙПАЕТ данные) / `db:ensure-admin`.
- Тесты: `npx tsx scripts/test-domain.ts` (домен/цены), `npm run db:test:overlap` (констрейнт).
- После правок кода в Docker: `docker compose build && docker compose up -d --force-recreate app`.

## Конвенции
- i18n: каждый ключ добавлять и в `messages/ru.json`, и в `messages/kk.json` (паритет обязателен).
- Server Actions в `lib/actions.ts` (с гардами auth/requireAdmin), публичные — `lib/public-actions.ts`; ожидаемые ошибки — `{ok:false, error}`, не throw.
- Ценообразование — чистая функция `lib/pricing.ts` (тарифы, скидки %/₸, предоплата-процент из Settings).
- Настройки заведения — singleton-модель `Settings` (`lib/settings.ts`, getSettings/saveSettings).
