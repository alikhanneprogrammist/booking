'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {setUserActiveAction, resetPasswordAction} from '@/lib/actions';
import type {MockUser} from '@/lib/mock-data';
import UserDialog from './UserDialog';

export default function UsersView({users}: {users: MockUser[]}) {
  const t = useTranslations('users');
  const router = useRouter();
  const [dialog, setDialog] = useState<{open: boolean; user?: MockUser}>({open: false});

  const btn = 'text-xs font-medium text-muted hover:text-foreground';

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <button onClick={() => setDialog({open: true})} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          + {t('add')}
        </button>
      </header>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t('name')}</th>
              <th className="px-4 py-2 font-medium">{t('phone')}</th>
              <th className="px-4 py-2 font-medium">{t('role')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t border-border ${u.isActive ? '' : 'opacity-50'}`}>
                <td className="px-4 py-2">
                  <span className="font-medium">{u.name}</span>
                  {!u.isActive && <span className="ml-2 text-[10px] text-muted">({t('inactive')})</span>}
                  {u.email && <div className="text-xs text-muted">{u.email}</div>}
                </td>
                <td className="px-4 py-2 text-muted">{u.phone}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${u.role === 'ADMIN' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                    {t(u.role)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button className={btn} onClick={() => setDialog({open: true, user: u})}>{t('edit')}</button>
                  <button
                    className={`ml-3 ${btn}`}
                    onClick={async () => {
                      await setUserActiveAction(u.id, !u.isActive);
                      router.refresh();
                    }}
                  >
                    {u.isActive ? t('deactivate') : t('activate')}
                  </button>
                  <button
                    className={`ml-3 ${btn}`}
                    onClick={async () => {
                      const res = await resetPasswordAction(u.id);
                      alert(t('tempPassword', {p: res.tempPassword}));
                    }}
                  >
                    {t('resetPassword')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog.open && (
        <UserDialog
          user={dialog.user}
          onClose={() => setDialog({open: false})}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
