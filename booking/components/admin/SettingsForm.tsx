'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {saveSettings} from '@/lib/actions';
import type {AppSettings} from '@/lib/settings';
import {adminInput as inputCls} from '@/lib/ui';

const MAX_LOGO_BYTES = 400 * 1024; // ~400 КБ (хранится как data-URL в БД)

// Вкладка редактирует ТОЛЬКО эти поля и только их отправляет в saveSettings —
// тексты публичной страницы (вторая вкладка) не затираются.
type VenueSettings = Pick<
  AppSettings,
  | 'companyName' | 'logoUrl' | 'minBookingHours' | 'prepaymentPercent'
  | 'phone' | 'whatsapp' | 'instagram' | 'email' | 'address' | 'requisites'
>;
type VenueTextKey = Exclude<keyof VenueSettings, 'logoUrl' | 'minBookingHours' | 'prepaymentPercent'>;

export default function SettingsForm({settings}: {settings: AppSettings}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<VenueSettings>({
    companyName: settings.companyName,
    logoUrl: settings.logoUrl,
    minBookingHours: settings.minBookingHours,
    prepaymentPercent: settings.prepaymentPercent,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    instagram: settings.instagram,
    email: settings.email,
    address: settings.address,
    requisites: settings.requisites,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoErr, setLogoErr] = useState('');

  function set<K extends keyof VenueSettings>(key: K, value: VenueSettings[K]) {
    setForm((f) => ({...f, [key]: value}));
    setSaved(false);
  }

  function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoErr('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoErr(t('venue.logoErrType'));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoErr(t('venue.logoErrSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logoUrl', String(reader.result));
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    set('logoUrl', '');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const field = (key: VenueTextKey, type: 'text' | 'textarea' = 'text') => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{t(`venue.${key}`)}</span>
      {type === 'textarea' ? (
        <textarea rows={3} className={inputCls} value={form[key]} onChange={(e) => set(key, e.target.value)} />
      ) : (
        <input type="text" className={inputCls} value={form[key]} onChange={(e) => set(key, e.target.value)} />
      )}
    </label>
  );

  const numField = (key: 'minBookingHours' | 'prepaymentPercent', min: number, max: number) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{t(`rules.${key}`)}</span>
      <input
        type="number"
        min={min}
        max={max}
        className={inputCls}
        value={form[key]}
        onChange={(e) => set(key, e.target.value === '' ? min : Number(e.target.value))}
      />
      <span className="mt-1 block text-[11px] text-muted">{t(`rules.${key}Hint`)}</span>
    </label>
  );

  const btn = 'rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-subtle';

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-lg font-semibold tracking-tight">{t('venue.title')}</h1>
      <p className="mb-5 text-sm text-muted">{t('venue.subtitle')}</p>

      {/* Логотип */}
      <div className="mb-6">
        <div className="mb-2 text-xs font-medium text-muted">{t('venue.logo')}</div>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-subtle">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted">{t('venue.noLogo')}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
                {t('venue.uploadLogo')}
              </button>
              {form.logoUrl && (
                <button type="button" className={`${btn} text-red-600`} onClick={removeLogo}>
                  {tc('delete')}
                </button>
              )}
            </div>
            <span className="text-[11px] text-muted">{t('venue.logoHint')}</span>
            {logoErr && <span className="text-[11px] text-red-600">{logoErr}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoPick} />
        </div>
      </div>

      {/* Контакты заведения */}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('companyName')}
        {field('phone')}
        {field('whatsapp')}
        {field('instagram')}
        {field('email')}
        {field('address')}
      </div>
      <div className="mt-4">{field('requisites', 'textarea')}</div>

      {/* Правила брони */}
      <h2 className="mb-1 mt-8 text-base font-semibold tracking-tight">{t('rules.title')}</h2>
      <p className="mb-4 text-sm text-muted">{t('rules.subtitle')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {numField('minBookingHours', 1, 24)}
        {numField('prepaymentPercent', 0, 100)}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? tc('loading') : tc('save')}
        </button>
        <span aria-live="polite" className="text-sm text-emerald-600">{saved ? t('saved') : ''}</span>
      </div>
    </form>
  );
}
