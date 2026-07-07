'use client';

import {useTranslations} from 'next-intl';
import type {BookingStatus} from '@/lib/types';

const STYLES: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  CONFIRMED: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  PREPAID: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  ARRIVED: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 line-through dark:bg-red-950 dark:text-red-300',
  NO_SHOW: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

// Единый источник цветов статуса для календаря (фон блока + точки легенды).
// Оттенки насыщенные (-200) и разнесены по спектру, чтобы статусы различались с первого взгляда.
export const STATUS_BG: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-200 dark:bg-zinc-700/60',
  CONFIRMED: 'bg-sky-200 dark:bg-sky-900/70',
  PREPAID: 'bg-violet-200 dark:bg-violet-900/70',
  ARRIVED: 'bg-teal-200 dark:bg-teal-900/70',
  COMPLETED: 'bg-green-200 dark:bg-green-900/70',
  CANCELLED: 'bg-red-200 dark:bg-red-900/70',
  NO_SHOW: 'bg-orange-200 dark:bg-orange-900/70',
};

export const STATUS_DOT: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-400',
  CONFIRMED: 'bg-sky-500',
  PREPAID: 'bg-violet-500',
  ARRIVED: 'bg-teal-500',
  COMPLETED: 'bg-green-500',
  CANCELLED: 'bg-red-500',
  NO_SHOW: 'bg-orange-500',
};

export default function StatusBadge({status}: {status: BookingStatus}) {
  const t = useTranslations('status');
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STYLES[status]}`}>
      {t(status)}
    </span>
  );
}
