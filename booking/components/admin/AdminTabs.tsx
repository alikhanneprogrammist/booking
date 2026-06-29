'use client';

import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';

const tabs = [
  {href: '/settings', key: 'venue', exact: true},
  {href: '/settings/resources', key: 'resources', exact: false},
  {href: '/settings/users', key: 'users', exact: false},
  {href: '/settings/waiters', key: 'waiters', exact: false},
  {href: '/settings/public', key: 'public', exact: false},
] as const;

export default function AdminTabs() {
  const t = useTranslations('settings');
  const pathname = usePathname();

  return (
    <div className="border-b border-border">
      <nav className="mx-auto flex max-w-5xl gap-1 px-6">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {t(`tabs.${tab.key}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
