'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {setWaiterActiveAction, removeWaiter} from '@/lib/actions';
import type {MockWaiter} from '@/lib/mock-data';
import WaiterDialog from './WaiterDialog';

export default function WaitersView({waiters}: {waiters: MockWaiter[]}) {
  const t = useTranslations('waiters');
  const router = useRouter();
  const [dialog, setDialog] = useState<{open: boolean; waiter?: MockWaiter}>({open: false});

  const btn = 'text-xs font-medium text-muted hover:text-foreground';

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <button onClick={() => setDialog({open: true})} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          + {t('add')}
        </button>
      </header>

      {waiters.length === 0 ? (
        <div className="rounded-lg border border-border py-10 text-center text-sm text-muted">{t('empty')}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('name')}</th>
                <th className="px-4 py-2 font-medium">{t('sortOrder')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {waiters.map((w) => (
                <tr key={w.id} className={`border-t border-border ${w.isActive ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{w.name}</span>
                    {!w.isActive && <span className="ml-2 text-[10px] text-muted">({t('inactive')})</span>}
                  </td>
                  <td className="px-4 py-2 text-muted">{w.sortOrder}</td>
                  <td className="px-4 py-2 text-right">
                    <button className={btn} onClick={() => setDialog({open: true, waiter: w})}>{t('edit')}</button>
                    <button
                      className={`ml-3 ${btn}`}
                      onClick={async () => {
                        await setWaiterActiveAction(w.id, !w.isActive);
                        router.refresh();
                      }}
                    >
                      {w.isActive ? t('deactivate') : t('activate')}
                    </button>
                    <button
                      className={`ml-3 ${btn}`}
                      onClick={async () => {
                        if (!confirm(t('confirmDelete'))) return;
                        const res = await removeWaiter(w.id);
                        if (!res.ok) {
                          alert(t('cantDelete'));
                          return;
                        }
                        router.refresh();
                      }}
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog.open && (
        <WaiterDialog
          waiter={dialog.waiter}
          onClose={() => setDialog({open: false})}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
