# OFFICE 2020 — образ приложения (Next.js 14 + Prisma 6).
# Многоэтапная сборка: deps → builder → runner.

FROM node:20-bookworm-slim AS base
# openssl нужен Prisma (engine debian-openssl-3.0.x), ca-certificates — для HTTPS при сборке.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ───────────────────────── Зависимости ────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ───────────────────────── Сборка ─────────────────────────────────────
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Страницы данных — force-dynamic, поэтому БД на этапе сборки не нужна.
# Шрифт Inter самохостится (app/fonts, next/font/local) — интернет на build НЕ нужен.
RUN npm run build

# ───────────────────────── Рантайм ────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Переносим всё приложение целиком: нужны prisma CLI (миграции), tsx (seed),
# собранный .next, prisma/migrations, lib, messages, i18n.
COPY --from=builder /app ./
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
