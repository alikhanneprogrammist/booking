'use client';

import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => router.replace(pathname, {locale: loc})}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            loc === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
