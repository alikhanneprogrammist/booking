'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {markVpsPaid} from '@/lib/actions';

/**
 * Баннер-напоминание об оплате VPS (до vpsPayDay числа каждого месяца, все
 * сотрудники): янтарный с 1-го числа, красный после срока — с датой ближайшего
 * дедлайна («до 3 августа»). «Оплачено» скрывает его для всех до след. месяца.
 */
export default function VpsReminder({overdue, deadline}: {overdue: boolean; deadline: string}) {
  const t = useTranslations('reminder');
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function paid() {
    setSaving(true);
    try {
      await markVpsPaid();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm font-medium ${
        overdue
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
      }`}
    >
      <span>💳 {overdue ? t('vpsOverdue', {deadline}) : t('vps', {deadline})}</span>
      <button
        onClick={paid}
        disabled={saving}
        className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
          overdue ? 'bg-red-600' : 'bg-amber-600'
        }`}
      >
        {saving ? '…' : t('paid')}
      </button>
    </div>
  );
}
