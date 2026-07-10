import {getTranslations} from 'next-intl/server';
import BrandLogo from '@/components/BrandLogo';
import Sidebar from '@/components/Sidebar';
import SidebarShell from '@/components/SidebarShell';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import {currentUser} from '@/lib/auth-helpers';
import {getSettings, getClients} from '@/lib/queries';
import {toAlmaty} from '@/lib/time';
import {upcomingBirthdays} from '@/lib/birthdays';
import {doSignOut} from '@/lib/auth-actions';

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const user = await currentUser();
  const isAdmin = user?.role === 'ADMIN';
  const settings = await getSettings();

  // Счётчик для бейджа «Дни рождения» — клиенты с ДР в ближайшие 7 дней (Алматы).
  const w = toAlmaty(new Date());
  const clients = await getClients();
  const birthdaysSoon = upcomingBirthdays(
    clients,
    {year: w.getFullYear(), month: w.getMonth(), day: w.getDate()},
    7,
  ).length;

  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-5 py-4 text-sm font-semibold tracking-tight">
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
        ) : (
          <BrandLogo />
        )}
        <span className="truncate">{settings.companyName || 'OFFICE 2020'}</span>
      </div>
      <Sidebar isAdmin={isAdmin} birthdaysSoon={birthdaysSoon} />
      <div className="mt-auto border-t border-border px-4 py-3">
        {user && (
          <div className="mb-2 truncate text-xs text-muted">
            {user.name} · {user.role}
          </div>
        )}
        <div className="flex items-center justify-between">
          <LocaleSwitcher />
          <form action={doSignOut}>
            <button
              type="submit"
              className="text-xs font-medium text-muted hover:text-foreground"
            >
              {t('nav.logout')}
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <SidebarShell
      logoUrl={settings.logoUrl || undefined}
      companyName={settings.companyName || 'OFFICE 2020'}
      menuLabel={t('nav.menu')}
      sidebar={sidebar}
    >
      {children}
    </SidebarShell>
  );
}
