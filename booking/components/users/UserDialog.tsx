'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {saveUser} from '@/lib/actions';
import {formatPhoneDraft} from '@/lib/phone';
import type {MockUser} from '@/lib/types';
import {dialogField, dialogLabel} from '@/lib/ui';

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
  const [phone, setPhone] = useState(formatPhoneDraft(u?.phone ?? ''));
  const [email, setEmail] = useState(u?.email ?? '');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER'>(u?.role ?? 'MANAGER');
  const [isActive, setIsActive] = useState(u?.isActive ?? true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Сгенерированный временный пароль показываем в самом диалоге (не alert):
  // его можно скопировать, и он не пропадёт от случайного Enter.
  const [tempPass, setTempPass] = useState<string | null>(null);

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
    onSaved?.();
    // Новому сотруднику сервер выдаёт временный пароль (FR-USER, §5.8).
    if (res.tempPassword) {
      setTempPass(res.tempPassword);
      return; // диалог остаётся открытым с паролем
    }
    onClose();
  }

  const field = dialogField;
  const label = dialogLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{u ? t('edit') : t('add')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">✕</button>
        </div>
        {tempPass ? (
          <>
            <p aria-live="polite" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40">
              {t('tempPassword', {p: ''})}
            </p>
            <div className="mt-2 select-all rounded-md border border-border bg-subtle px-3 py-2 text-center font-mono text-base tracking-wide">
              {tempPass}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                {t('back')}
              </button>
            </div>
          </>
        ) : (
        <>
        <div className="flex flex-col gap-3">
          <label className={label}>{t('name')}<input className={field} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          <label className={label}>{t('phone')}<input className={field} type="tel" value={phone} onChange={(e) => setPhone(formatPhoneDraft(e.target.value))} placeholder="+7 700 000 00 00" /></label>
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
          {error && <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-subtle">{t('back')}</button>
          <button onClick={save} disabled={saving || !name.trim() || phone.replace(/\D/g, '').length <= 1} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {u ? t('save') : t('create')}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
