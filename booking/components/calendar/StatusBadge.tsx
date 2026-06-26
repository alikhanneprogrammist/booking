'use client';

import {useTranslations} from 'next-intl';
import type {BookingStatus} from '@/lib/mock-data';

const STYLES: Record<BookingStatus, string> = {
  NEW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  PREPAID: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-700 line-through dark:bg-red-950 dark:text-red-300',
  NO_SHOW: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

export default function StatusBadge({status}: {status: BookingStatus}) {
  const t = useTranslations('status');
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STYLES[status]}`}>
      {t(status)}
    </span>
  );
}
