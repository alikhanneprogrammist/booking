'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import {removeClient} from '@/lib/actions';
import {formatBirthday} from '@/lib/birthdays';
import type {MockClient, MockBooking, MockResource} from '@/lib/types';
import {TIMEZONE} from '@/lib/time';
import {fmtTime} from '@/lib/calendar';
import StatusBadge from '@/components/calendar/StatusBadge';
import ClientDialog from './ClientDialog';

export default function ClientCard({
  client, history, resources,
}: {
  id: string;
  client: MockClient | null;
  history: MockBooking[];
  resources: MockResource[];
}) {
  const t = useTranslations('clients');
  const tt = useTranslations('tariff');
  const locale = useLocale();
  const router = useRouter();
  const [edit, setEdit] = useState(false);

  const resOf = (rid: string) => resources.find((r) => r.id === rid);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(locale, {timeZone: TIMEZONE, day: 'numeric', month: 'short'}).format(d);

  if (!client) {
    return (
      <div className="p-6">
        <Link href="/clients" className="text-sm text-muted hover:underline">{t('back')}</Link>
        <div className="py-12 text-center text-sm text-muted">{t('notFound')}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/clients" className="text-sm text-muted hover:underline">{t('back')}</Link>

      <div className="mt-3 flex items-start justify-between rounded-xl border border-border bg-card p-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
          <div className="mt-1 text-sm text-muted">{client.phone}</div>
          {client.dateOfBirth && (
            <div className="mt-1 text-sm text-muted">🎂 {formatBirthday(client.dateOfBirth, locale)}</div>
          )}
          {client.note && <div className="mt-2 text-sm">{client.note}</div>}
          <div className="mt-2 flex flex-wrap gap-1">
            {(client.tags ?? []).map((tag) => (
              <span key={tag} className="rounded bg-subtle px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border">{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEdit(true)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">
            {t('edit')}
          </button>
          <button
            onClick={async () => {
              if (!confirm(t('confirmDelete'))) return;
              const res = await removeClient(client.id);
              if (!res.ok) {
                alert(t('cantDelete'));
                return;
              }
              router.push('/clients');
            }}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            {t('delete')}
          </button>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-medium uppercase tracking-wide text-muted">{t('history')}</h2>
      {history.length === 0 ? (
        <div className="rounded-lg border border-border py-8 text-center text-sm text-muted">{t('noHistory')}</div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {history.map((b) => {
            const r = resOf(b.resourceId);
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="w-24 shrink-0 text-muted">{fmtDate(b.startAt)}</div>
                <div className="w-28 shrink-0 tabular-nums text-muted">
                  {fmtTime(b.startAt, locale)}–{fmtTime(b.endAt, locale)}
                </div>
                <div className="flex flex-1 items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor: r?.color}} />
                  <span className="truncate font-medium">{locale === 'kk' ? r?.nameKk : r?.nameRu}</span>
                  <span className="text-xs text-muted">· {tt(b.tariff)}</span>                </div>
                <StatusBadge status={b.status} />
                {b.discountType !== 'NONE' && b.discountValue > 0 && (
                  <span
                    title={t('discount')}
                    className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900"
                  >
                    −{b.discountType === 'PERCENT' ? `${b.discountValue}%` : `${b.discountValue.toLocaleString()} ₸`}
                  </span>
                )}
                <div className="w-24 shrink-0 text-right tabular-nums">{b.total.toLocaleString()} ₸</div>
              </div>
            );
          })}
        </div>
      )}

      {edit && (
        <ClientDialog
          mode="edit"
          client={client}
          onClose={() => setEdit(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
