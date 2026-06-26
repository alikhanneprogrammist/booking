'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {saveSettings} from '@/lib/actions';
import type {AppSettings} from '@/lib/settings';

const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary';

export default function PublicContentForm({settings}: {settings: AppSettings}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const router = useRouter();

  // Храним весь объект настроек, чтобы saveSettings не затёр поля заведения.
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((f) => ({...f, [key]: value}));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  // Двуязычная пара (ru + kk) для одного поля.
  const pair = (
    labelKey: string,
    ruKey: keyof AppSettings,
    kkKey: keyof AppSettings,
    type: 'text' | 'textarea' = 'text',
  ) => (
    <div>
      <div className="mb-1 text-xs font-medium text-muted">{t(`public.${labelKey}`)}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {k: ruKey, lang: 'RU'},
          {k: kkKey, lang: 'KK'},
        ].map(({k, lang}) => (
          <div key={lang} className="relative">
            <span className="absolute right-2 top-2 text-[10px] font-medium text-muted">{lang}</span>
            {type === 'textarea' ? (
              <textarea rows={3} className={inputCls} value={form[k]} onChange={(e) => set(k, e.target.value)} />
            ) : (
              <input type="text" className={inputCls} value={form[k]} onChange={(e) => set(k, e.target.value)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-5xl p-6">
      <header className="mb-1">
        <h1 className="text-lg font-semibold tracking-tight">{t('public.title')}</h1>
      </header>
      <p className="mb-5 text-sm text-muted">{t('public.subtitle')}</p>

      <div className="space-y-4">
        {pair('pageTitle', 'publicTitleRu', 'publicTitleKk')}
        {pair('pageSubtitle', 'publicSubtitleRu', 'publicSubtitleKk')}
        {pair('info', 'publicInfoRu', 'publicInfoKk', 'textarea')}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">{t('public.contacts')}</span>
          <input
            type="text"
            className={inputCls}
            value={form.publicContacts}
            onChange={(e) => set('publicContacts', e.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? tc('loading') : tc('save')}
        </button>
        {saved && <span className="text-sm text-emerald-600">{t('saved')}</span>}
      </div>
    </form>
  );
}
