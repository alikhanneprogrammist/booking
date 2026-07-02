#!/usr/bin/env bash
# Ежедневный бэкап БД бронирования (pg_dump из Docker-контейнера db).
# Запускается кроном; вручную: bash scripts/backup-db.sh
#
# Дампы: ~/backups/office2020/booking_YYYY-MM-DD_HHMM.dump (custom-формат, сжатый).
# Ротация: храним последние KEEP_DAYS дней.
# Восстановление (см. deploy.md §7):
#   cat <файл>.dump | docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/office2020}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$APP_DIR"
# Креды БД — из booking/.env (POSTGRES_*).
set -a; . ./.env; set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M)"
OUT="$BACKUP_DIR/booking_${STAMP}.dump"

# -T: без TTY (нужно под кроном). Пишем во временный файл, переименовываем атомарно.
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"

# Пустой/битый дамп лучше заметить сразу.
[ -s "$OUT" ] || { echo "ERROR: empty dump $OUT" >&2; exit 1; }

# Ротация: удаляем дампы старше KEEP_DAYS дней.
find "$BACKUP_DIR" -name 'booking_*.dump' -mtime "+$KEEP_DAYS" -delete

echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"
