// Bootstrap первого администратора из окружения (ADMIN_PHONE / ADMIN_PASSWORD / ADMIN_NAME).
// Идемпотентно: создаёт админа, если его ещё нет; данные/пароль существующего НЕ затирает.
// Вызывается из docker-entrypoint.sh после `prisma migrate deploy` (на каждом старте — безопасно).
// Ручной запуск с хоста: npm run db:ensure-admin
//
// Пароль из .env применяется ТОЛЬКО при создании. Дальше пароль живёт в БД —
// менять его нужно через «Сброс пароля» в разделе «Сотрудники». Ротация через .env не предусмотрена.

import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {normalizePhone} from '../lib/phone';

const prisma = new PrismaClient();

async function main() {
  const rawPhone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Администратор';

  // Без обязательных переменных — пропускаем (dev/CI, где админ приходит из db:seed).
  if (!rawPhone || !password) {
    console.log('→ ensure-admin: ADMIN_PHONE/ADMIN_PASSWORD не заданы — bootstrap пропущен.');
    return;
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    console.log(`→ ensure-admin: ADMIN_PHONE="${rawPhone}" невалиден после нормализации — bootstrap пропущен.`);
    return;
  }

  const existing = await prisma.user.findUnique({where: {phone}});

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {name, phone, passwordHash, role: 'ADMIN', isActive: true},
    });
    console.log(`→ ensure-admin: админ ${phone} создан (роль ADMIN, активен).`);
    return;
  }

  // Админ уже есть: пароль НЕ трогаем. Защитно гарантируем, что он не заблокирован и не понижен,
  // чтобы случайная деактивация/смена роли не заперла единственный вход.
  if (existing.role !== 'ADMIN' || !existing.isActive) {
    await prisma.user.update({
      where: {id: existing.id},
      data: {role: 'ADMIN', isActive: true},
    });
    console.log(`→ ensure-admin: админ ${phone} уже есть — восстановил роль ADMIN/активность (пароль без изменений).`);
  } else {
    console.log(`→ ensure-admin: админ ${phone} уже есть — изменений нет (пароль без изменений).`);
  }
}

main()
  .catch((e) => {
    console.error('→ ensure-admin: ошибка bootstrap админа:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
