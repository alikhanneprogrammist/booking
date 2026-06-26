'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation';
import type {MockClient, MockBooking} from '@/lib/mock-data';
import ClientDialog from './ClientDialog';

export default function ClientsView({
  clients, bookings,
}: {
  clients: MockClient[];
  bookings: MockBooking[];
}) {
  const t = useTranslations('clients');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    const qDigits = q.replace(/\D/g, '');
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits && c.phone.replace(/\D/g, '').includes(qDigits)),
    );
  }, [query, clients]);

  const visits = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings) if (b.status !== 'CANCELLED') m.set(b.clientId, (m.get(b.clientId) ?? 0) + 1);
    return m;
  }, [bookings]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
          />
          <button
            onClick={() => setDialog(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + {t('add')}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {list.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">{t('empty')}</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('name')}</th>
                  <th className="px-4 py-2 font-medium">{t('phone')}</th>
                  <th className="px-4 py-2 font-medium">{t('tags')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('visits')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-subtle">
                    <td className="px-4 py-2">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-2 text-muted">{c.phone}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).map((tag) => (
                          <span key={tag} className="rounded bg-subtle px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{visits.get(c.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog && (
        <ClientDialog
          mode="create"
          onClose={() => setDialog(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
