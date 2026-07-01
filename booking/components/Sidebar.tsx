'use client';

import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';

const items = [
  {href: '/calendar', key: 'calendar', icon: '🗓', adminOnly: false},
  {href: '/clients', key: 'clients', icon: '👤', adminOnly: false},
  {href: '/birthdays', key: 'birthdays', icon: '🎂', adminOnly: false},
  {href: '/analytics', key: 'analytics', icon: '📊', adminOnly: true},
  {href: '/settings', key: 'admin', icon: '⚙', adminOnly: true},
] as const;

export default function Sidebar({isAdmin, birthdaysSoon = 0}: {isAdmin: boolean; birthdaysSoon?: number}) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {items
        .filter((it) => !it.adminOnly || isAdmin)
        .map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-subtle text-foreground'
                  : 'text-muted hover:bg-subtle hover:text-foreground'
              }`}
            >
              <span className="text-base leading-none">{it.icon}</span>
              <span className="flex-1">{t(it.key)}</span>
              {it.key === 'birthdays' && birthdaysSoon > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {birthdaysSoon}
                </span>
              )}
            </Link>
          );
        })}
    </nav>
  );
}
