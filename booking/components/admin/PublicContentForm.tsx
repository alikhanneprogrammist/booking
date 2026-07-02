'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {saveSettings} from '@/lib/actions';
import type {AppSettings} from '@/lib/settings';
import {adminInput as inputCls} from '@/lib/ui';

// Вкладка редактирует ТОЛЬКО тексты публичной страницы и только их отправляет
// в saveSettings — поля заведения (первая вкладка) не затираются.
type PublicSettings = Pick<
  AppSettings,
  | 'publicTitleRu' | 'publicTitleKk' | 'publicSubtitleRu' | 'publicSubtitleKk'
  | 'publicInfoRu' | 'publicInfoKk' | 'publicContacts'
>;

export default function PublicContentForm({settings}: {settings: AppSettings}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const router = useRouter();

  const [form, setForm] = useState<PublicSettings>({
    publicTitleRu: settings.publicTitleRu,
    publicTitleKk: settings.publicTitleKk,
    publicSubtitleRu: settings.publicSubtitleRu,
    publicSubtitleKk: settings.publicSubtitleKk,
    publicInfoRu: settings.publicInfoRu,
    publicInfoKk: settings.publicInfoKk,
    publicContacts: settings.publicContacts,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
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
    ruKey: keyof PublicSettings,
    kkKey: keyof PublicSettings,
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
        <span aria-live="polite" className="text-sm text-emerald-600">{saved ? t('saved') : ''}</span>
      </div>
    </form>
  );
}
