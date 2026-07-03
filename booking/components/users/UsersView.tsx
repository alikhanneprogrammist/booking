'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {setUserActiveAction, resetPasswordAction} from '@/lib/actions';
import type {MockUser} from '@/lib/types';
import UserDialog from './UserDialog';

export default function UsersView({users}: {users: MockUser[]}) {
  const t = useTranslations('users');
  const router = useRouter();
  const [dialog, setDialog] = useState<{open: boolean; user?: MockUser}>({open: false});
  // Мини-диалог сброса пароля (вместо window.prompt/alert).
  const [resetFor, setResetFor] = useState<MockUser | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  function openReset(u: MockUser) {
    setResetFor(u);
    setNewPass('');
    setResetErr(null);
    setResetDone(false);
  }

  async function submitReset() {
    if (!resetFor) return;
    setResetErr(null);
    setResetSaving(true);
    const res = await resetPasswordAction(resetFor.id, newPass);
    setResetSaving(false);
    if (!res.ok) {
      setResetErr(t('weakPassword'));
      return;
    }
    setResetDone(true);
  }

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
                  <button className={`ml-3 ${btn}`} onClick={() => openReset(u)}>
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

      {/* Сброс пароля (FR-USER-3): админ задаёт новый пароль вручную */}
      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResetFor(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">{t('resetPassword')}</h2>
              <button onClick={() => setResetFor(null)} className="text-muted hover:text-foreground">✕</button>
            </div>
            {resetDone ? (
              <>
                <p aria-live="polite" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40">
                  {t('passwordChanged')} — {resetFor.name}
                </p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setResetFor(null)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                    {t('back')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t('enterNewPassword')}
                  <input
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40"
                    type="text"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className="mt-1 text-[11px] text-muted">{resetFor.name} · {resetFor.phone}</div>
                {resetErr && (
                  <div role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{resetErr}</div>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setResetFor(null)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">
                    {t('back')}
                  </button>
                  <button
                    onClick={submitReset}
                    disabled={resetSaving || !newPass.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {t('save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
