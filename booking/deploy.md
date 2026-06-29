# Деплой OFFICE 2020

Руководство по развёртыванию системы бронирования. Основной способ — **Docker Compose** (приложение + PostgreSQL в одном стеке, миграции накатываются автоматически).

- **Стек:** Next.js 14 (App Router) + Prisma 6 + PostgreSQL 16 + Auth.js 5
- **Таймзона:** Asia/Almaty
- **Порты:** приложение `3000`, БД `5432`
- **Вход администратора:** из `ADMIN_PHONE` / `ADMIN_PASSWORD` в `.env` (создаётся при старте)

> Все команды выполняются из каталога `booking/` (там лежат `docker-compose.yml`, `Dockerfile`, `.env`). Compose-файла в корне репозитория нет.

---

## 1. Требования

- Docker Engine 24+ и Docker Compose v2 (`docker compose`, не `docker-compose`).
- Открытые/проброшенные порты `3000` (и `5432`, если нужен доступ к БД с хоста).
- ~2 ГБ под образ + том `pgdata`.

Расширение `btree_gist` (анти-овербукинг, ТЗ §4.6) входит в стандартный образ `postgres:16` и включается миграцией `20260101000001_booking_no_overlap` — отдельно ставить ничего не нужно.

---

## 2. Настройка окружения (`.env`)

Скопируйте шаблон и заполните значения:

```bash
cp .env.example .env
```

Сгенерируйте сильные секреты и впишите их в `.env`:

```bash
openssl rand -hex 24      # → POSTGRES_PASSWORD
openssl rand -base64 32   # → AUTH_SECRET
```

Минимально нужно задать:

| Переменная          | Назначение                                          |
|---------------------|-----------------------------------------------------|
| `POSTGRES_USER`     | роль БД (по умолчанию `office2020`)                 |
| `POSTGRES_PASSWORD` | **обязательно**, сильный пароль                     |
| `POSTGRES_DB`       | имя БД (по умолчанию `office2020`)                  |
| `AUTH_SECRET`       | **обязательно**, секрет подписи сессий Auth.js      |
| `DATABASE_URL`      | для CLI/Prisma **с хоста** (host=`127.0.0.1`)       |
| `ADMIN_PHONE`       | телефон первого администратора (bootstrap)          |
| `ADMIN_PASSWORD`    | пароль первого администратора (только при создании) |
| `ADMIN_NAME`        | имя админа (опц., дефолт «Администратор»)            |
| `TZ`                | `Asia/Almaty`                                       |

**Первый администратор задаётся в `.env`** (`ADMIN_PHONE` / `ADMIN_PASSWORD`) и создаётся
автоматически при старте контейнера — отдельно сидить пользователей для прода НЕ нужно (см. §4).
`ADMIN_PASSWORD` применяется **только при создании** админа: при последующих перезапусках пароль
в БД не затирается (менять его — через «Сброс пароля» в UI). Если оставить `ADMIN_*` пустыми,
шаг bootstrap пропускается.

Важно про `DATABASE_URL`:
- **Контейнер `app`** свой URL строит сам из `POSTGRES_*` (host=`db` внутри сети compose) — менять не нужно.
- Значение `DATABASE_URL` в `.env` используется только для команд Prisma/`psql` **с хоста** (миграции, seed вручную). Для проброшенного порта host = `127.0.0.1:5432`.

> `.env` в `.gitignore` и НЕ коммитится. `AUTH_SECRET` и `POSTGRES_PASSWORD` заданы с `:?` — если они пустые, контейнеры не стартуют (fail-fast).

---

## 3. Запуск

```bash
docker compose up -d --build
```

Что произойдёт:
1. Поднимается `db` (`postgres:16`) с healthcheck.
2. После `healthy` стартует `app`: entrypoint выполняет `prisma migrate deploy` (идемпотентно накатывает все миграции), затем **ensure-admin** (создаёт администратора из `ADMIN_*`, если его ещё нет — идемпотентно), затем `next start`.

Признак здоровья в логах `app`:

```
→ Применяю миграции БД (prisma migrate deploy)…
→ Запускаю приложение…
✓ Ready
```

Проверка:

```bash
docker compose ps
docker compose logs -f app
curl -I http://localhost:3000/ru/book   # → 200
```

---

## 4. Пользователи и данные

### Администратор — автоматически из `.env`
Первый администратор **не требует seed**: он создаётся при старте контейнера из `ADMIN_PHONE` /
`ADMIN_PASSWORD` (шаг ensure-admin, идемпотентно). Достаточно задать их в `.env` и поднять стек —
сразу можно входить. Ручной запуск/проверка при необходимости:

```bash
docker compose run --rm app npm run db:ensure-admin
```

### Раздача доступов сотрудникам
Дальше всех остальных сотрудников заводит сам админ в приложении:
**«Администрирование» → «Сотрудники» → добавить сотрудника**. При создании система выдаёт
**временный пароль** — его сообщают сотруднику для входа. Там же: «Сброс пароля», смена роли
(ADMIN/MANAGER), включение/выключение учётки. Отдельных env-переменных на каждого не нужно.

### Демо-данные (опционально, для теста)
`db:seed` заливает демонстрационные данные (5 VIP-объектов, 6 доп. услуг, демо-клиенты/брони и
демо-сотрудники). **Очищает существующие данные** — на прод-БД не запускать:

```bash
docker compose run --rm app npm run db:seed   # ⚠️ ВАЙПАЕТ данные — только для теста/демо
```

---

## 5. Обновление версии

```bash
git pull
docker compose up -d --build      # пересборка образа, миграции накатятся сами
```

Том `pgdata` сохраняется — данные не теряются. Если порт `3000` занят «застрявшим» контейнером `app`, пересоздайте его принудительно:

```bash
docker compose rm -sf app && docker compose up -d --force-recreate app
```

---

## 6. Управление стеком

```bash
docker compose down           # остановить (том pgdata сохраняется)
docker compose down -v        # ⚠️ остановить И УДАЛИТЬ данные (том pgdata)
docker compose logs -f app    # логи приложения
docker compose exec db psql -U office2020 -d office2020   # консоль БД
```

Сменить пароль роли БД вживую (без сброса данных):

```bash
docker compose exec db psql -U office2020 -d office2020 \
  -c "ALTER ROLE office2020 WITH PASSWORD 'НОВЫЙ_ПАРОЛЬ';"
```

После смены обновите `POSTGRES_PASSWORD`/`DATABASE_URL` в `.env`.

---

## 7. Бэкап и восстановление

```bash
# Бэкап
docker compose exec db pg_dump -U office2020 -d office2020 -Fc > backup_$(date +%F).dump

# Восстановление в чистую БД
cat backup.dump | docker compose exec -T db pg_restore -U office2020 -d office2020 --clean
```

Регулярно бэкапьте том `pgdata` или делайте `pg_dump` по расписанию (cron).

---

## 8. Прод за reverse-proxy (HTTPS)

Приложение слушает HTTP `:3000`. Для домена/TLS поставьте впереди Nginx/Caddy/Traefik:

- Проксируйте `https://домен` → `http://app:3000`.
- Для безопасности уберите публикацию порта БД: удалите блок `ports: ["5432:5432"]` у сервиса `db` в `docker-compose.yml` (доступ к БД останется только внутри сети compose).
- Auth.js работает за прокси корректно при правильных заголовках (`X-Forwarded-*`).

Пример локации Nginx:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 9. Свой / внешний PostgreSQL (без контейнера db)

Если БД хостится отдельно (свой сервер, managed Postgres):

1. Убедитесь, что в БД доступно расширение `btree_gist`.
2. В `.env` пропишите `DATABASE_URL` на ваш хост (для managed обычно `sslmode=require`).
3. Накатите миграции и (один раз) seed с хоста:

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # на этой машине Node лежит в ~/.local/node
npm run db:migrate
npm run db:seed        # один раз, очищает данные
```

4. Запускайте только сервис `app` (уберите сервис `db` из compose или используйте `app` с внешним `DATABASE_URL` через окружение).

---

## 10. Чек-лист продакшена

- [ ] `POSTGRES_PASSWORD` и `AUTH_SECRET` — сильные, сгенерированы `openssl`, не из примера.
- [ ] `.env` не закоммичен.
- [ ] Порт `5432` не опубликован наружу (или закрыт фаерволом).
- [ ] HTTPS через reverse-proxy.
- [ ] `db:seed` выполнен один раз; на боевых данных больше не запускается.
- [ ] Настроен бэкап (`pg_dump`/том `pgdata`).
- [ ] Публичная форма `/ru/book` отдаёт 200; вход админа работает.

---

## Частые проблемы

| Симптом | Причина / решение |
|---|---|
| `app` крэш-луп, `P1001 Can't reach db:5432` | Порт 3000 на хосте занят стейл-процессом → `app` не прикрепился к сети. Освободить порт (`ss -ltnp \| grep :3000`, убить по PID) и `docker compose rm -sf app && docker compose up -d --force-recreate app`. |
| `AUTH_SECRET is required` / `POSTGRES_PASSWORD is required` | Переменная пустая в `.env` (fail-fast `:?`). Заполнить. |
| `Failed to load SWC binary` при сборке | Флап `npm ci` (не поставился optional `@next/swc-linux-x64-gnu`). Повторить `docker compose build`. |
| Демо-скидка/данные не видны | Появляются только после `db:seed` (он же вайпает данные). Сами фичи работают на новых бронях без сида. |

---

_Вход администратора — из `ADMIN_PHONE` / `ADMIN_PASSWORD` в `.env`. Ссылка для клиентов (публичная форма): `http://<хост>:3000/ru/book`._
