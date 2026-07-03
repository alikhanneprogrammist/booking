# OFFICE 2020 — система бронирования

Внутренняя система брони VIP-объектов (аналог Altegio): календарь занятости 24/7
с анти-овербукингом на уровне БД, клиенты, аналитика, публичная форма заявок,
двуязычный интерфейс (рус/каз).

**Стек:** Next.js 14 (App Router) · Prisma 6 · PostgreSQL 16 · Auth.js 5 · Tailwind · next-intl

## Быстрый старт

```bash
cp .env.example .env      # заполнить секреты (см. deploy.md §2)
docker compose up -d --build
# приложение: http://localhost:3000  ·  публичная форма: /ru/book
```

Миграции и первый администратор (`ADMIN_PHONE`/`ADMIN_PASSWORD` из `.env`)
создаются автоматически при старте. Полное руководство по установке,
обновлению, бэкапам и HTTPS — **[deploy.md](deploy.md)**.

## Разработка

```bash
npm ci
npm run dev               # dev-сервер (нужен Postgres из compose или свой)
npx tsc --noEmit          # типы
npm run test:unit         # юнит-тесты (без БД)
npm run test:db           # интеграционные (нужна поднятая БД с сидом)
npm run test              # всё
```

CI (GitHub Actions) на каждый пуш: типы → юнит-тесты → миграции + сид →
интеграционные тесты → тест анти-овербукинга → прод-сборка.

## Структура

| Путь | Что там |
|---|---|
| `app/[locale]/(app)/` | разделы за логином: календарь, клиенты, аналитика, админка |
| `app/[locale]/(public)/book/` | публичная форма заявок (без логина, rate-limit + honeypot) |
| `lib/bookings.ts` | домен брони: валидация, анти-овербукинг, авторасчёт цены |
| `lib/pricing.ts` | чистый расчёт стоимости (тарифы, скидки) |
| `lib/queries.ts` / `lib/actions.ts` | серверные чтения (Prisma → DTO) / мутации с гардами |
| `lib/enums.ts` / `lib/types.ts` | enum-значения домена / DTO-типы |
| `prisma/` | схема, миграции (вкл. exclusion constraint `booking_no_overlap`), сид |
| `messages/` | словари ru/kk (паритет ключей проверяется тестом) |
| `scripts/backup-db.sh` | ежедневный бэкап БД (cron), см. deploy.md §7 |
