#!/bin/sh
# Старт контейнера приложения: накатываем миграции (идемпотентно), затем запуск.
# Seed НЕ запускаем автоматически — он очищает данные (см. README: db:seed как one-off).
set -e

echo "→ Применяю миграции БД (prisma migrate deploy)…"
npx prisma migrate deploy

echo "→ Запускаю приложение…"
exec "$@"
