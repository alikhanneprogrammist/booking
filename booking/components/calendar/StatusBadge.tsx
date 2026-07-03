'use client';

import {useTranslations} from 'next-intl';
import type {BookingStatus} from '@/lib/types';

const STYLES: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  PREPAID: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-700 line-through dark:bg-red-950 dark:text-red-300',
  NO_SHOW: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

// Единый источник цветов статуса для календаря (фон блока + точки легенды).
export const STATUS_BG: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-100 dark:bg-zinc-800/60',
  CONFIRMED: 'bg-blue-100 dark:bg-blue-950/60',
  PREPAID: 'bg-violet-100 dark:bg-violet-950/60',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-950/60',
  CANCELLED: 'bg-red-100 dark:bg-red-950/60',
  NO_SHOW: 'bg-amber-100 dark:bg-amber-950/60',
};

export const STATUS_DOT: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-400',
  CONFIRMED: 'bg-blue-500',
  PREPAID: 'bg-violet-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-500',
  NO_SHOW: 'bg-amber-500',
};

export default function StatusBadge({status}: {status: BookingStatus}) {
  const t = useTranslations('status');
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STYLES[status]}`}>
      {t(status)}
    </span>
  );
}
