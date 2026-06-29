#!/bin/sh
# Старт контейнера приложения: накатываем миграции (идемпотентно), затем запуск.
# Seed НЕ запускаем автоматически — он очищает данные (см. README: db:seed как one-off).
set -e

echo "→ Применяю миграции БД (prisma migrate deploy)…"
npx prisma migrate deploy

# Bootstrap первого администратора из ADMIN_PHONE/ADMIN_PASSWORD (идемпотентно, без вайпа).
# Если переменные не заданы — скрипт сам пропускает шаг.
echo "→ Проверяю администратора (ensure-admin)…"
npx tsx scripts/ensure-admin.ts

echo "→ Запускаю приложение…"
exec "$@"
