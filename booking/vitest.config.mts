import path from 'node:path';
import {defineConfig} from 'vitest/config';

// .mts: конфиг должен грузиться как ESM (пакет без "type":"module").
export default defineConfig({
  test: {
    environment: 'node',
    // tests/unit — чистые функции, без БД; tests/db — интеграция с Postgres
    include: ['tests/**/*.test.ts'],
    // db-тесты пишут в одну БД и считают общие счётчики — файлы не параллелим
    fileParallelism: false,
  },
  resolve: {
    // алиас '@/…' как в tsconfig
    alias: {'@': path.resolve(import.meta.dirname)},
  },
});
