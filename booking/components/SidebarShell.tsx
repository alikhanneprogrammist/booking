'use client';

import {useEffect, useState} from 'react';
import {usePathname} from '@/i18n/navigation';
import BrandLogo from '@/components/BrandLogo';

/**
 * Адаптивная оболочка: на десктопе (md+) — статичный сайдбар 240px, как раньше;
 * на мобильном — скрыт, сверху узкая полоса с бургером, сайдбар выезжает
 * drawer'ом поверх контента. Закрывается по backdrop и при смене маршрута.
 * Server-layout передаёт готовое содержимое сайдбара в проп `sidebar`.
 */
export default function SidebarShell({
  logoUrl, companyName, menuLabel, sidebar, children,
}: {
  logoUrl?: string;
  companyName: string;
  menuLabel: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Закрываем drawer при переходе по ссылке меню.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:flex md:min-h-screen">
      {/* Мобильная верхняя полоса с бургером (только < md) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card px-3 md:hidden">
        <button
          type="button"
          aria-label={menuLabel}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
        ) : (
          <BrandLogo />
        )}
        <span className="truncate text-sm font-semibold tracking-tight">{companyName}</span>
      </header>

      {/* Backdrop (мобильный, когда drawer открыт) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Сайдбар: drawer на мобильном, статичная колонка на md+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-border bg-card transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      {/* Контент: на мобильном отступ сверху под фиксированную полосу */}
      <main className="overflow-auto pt-12 md:h-auto md:flex-1 md:pt-0">{children}</main>
    </div>
  );
}
