import {getLocale, getTranslations} from 'next-intl/server';
import BrandLogo from '@/components/BrandLogo';
import Sidebar from '@/components/Sidebar';
import SidebarShell from '@/components/SidebarShell';
import {currentUser} from '@/lib/auth-helpers';
import {getSettings, getClients, getVpsPaidMonth} from '@/lib/queries';
import VpsReminder from '@/components/VpsReminder';
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

  // Напоминание об оплате VPS (до settings.vpsPayDay числа): показываем, пока
  // текущий месяц не отмечен «Оплачено»; после срока — красное и с датой
  // ближайшего дедлайна уже следующего месяца («до 3 августа»).
  const w = toAlmaty(new Date());
  const monthKey = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}`;
  const vpsPaidMonth = await getVpsPaidMonth();
  const showVps = vpsPaidMonth !== monthKey;
  const vpsOverdue = w.getDate() > settings.vpsPayDay;
  const deadline = new Date(Date.UTC(
    w.getFullYear(), w.getMonth() + (vpsOverdue ? 1 : 0), settings.vpsPayDay,
  ));
  const locale = await getLocale();
  const vpsDeadline = deadline.toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  });

  // Счётчик для бейджа «Дни рождения» — клиенты с ДР в ближайшие 7 дней (Алматы).
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
        <form action={doSignOut}>
          <button
            type="submit"
            className="flex items-center gap-2 text-xs font-medium text-muted hover:text-foreground"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            {t('nav.logout')}
          </button>
        </form>
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
      <div className="flex h-full flex-col">
        {showVps && <VpsReminder overdue={vpsOverdue} deadline={vpsDeadline} />}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </SidebarShell>
  );
}
