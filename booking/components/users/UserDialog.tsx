'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {saveUser} from '@/lib/actions';
import type {MockUser} from '@/lib/mock-data';

export default function UserDialog({
  user, onClose, onSaved,
}: {
  user?: MockUser;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations('users');
  const u = user;
  const [name, setName] = useState(u?.name ?? '');
  const [phone, setPhone] = useState(u?.phone ?? '');
  const [email, setEmail] = useState(u?.email ?? '');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER'>(u?.role ?? 'MANAGER');
  const [isActive, setIsActive] = useState(u?.isActive ?? true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await saveUser({
      id: u?.id, name: name.trim(), phone: phone.trim(),
      email: email.trim() || undefined, role, isActive,
      password: !u ? (password.trim() || undefined) : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error === 'WEAK_PASSWORD' ? t('weakPassword') : t('duplicatePhone'));
      return;
    }
    // Новому сотруднику сервер выдаёт временный пароль (FR-USER, §5.8).
    if (res.tempPassword) alert(t('tempPassword', {p: res.tempPassword}));
    onSaved?.();
    onClose();
  }

  const field = 'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40';
  const label = 'flex flex-col gap-1 text-xs font-medium text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{u ? t('edit') : t('add')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <label className={label}>{t('name')}<input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          <label className={label}>{t('phone')}<input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 000 00 00" /></label>
          <label className={label}>{t('email')}<input className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className={label}>{t('role')}
            <select className={field} value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MANAGER')}>
              <option value="MANAGER">{t('MANAGER')}</option>
              <option value="ADMIN">{t('ADMIN')}</option>
            </select>
          </label>
          {!u && (
            <label className={label}>{t('password')}
              <input className={field} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordHint')} />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            {t('active')}
          </label>
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">{t('back')}</button>
          <button onClick={save} disabled={saving || !name.trim() || !phone.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {u ? t('save') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
