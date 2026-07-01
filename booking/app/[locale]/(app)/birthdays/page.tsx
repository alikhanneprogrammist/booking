import {setRequestLocale} from 'next-intl/server';
import BirthdaysView from '@/components/birthdays/BirthdaysView';
import {getClients} from '@/lib/queries';
import {toAlmaty} from '@/lib/time';
import type {Today} from '@/lib/birthdays';

// Доступно всем залогиненным (ADMIN и MANAGER), как /clients. Живые данные.
export const dynamic = 'force-dynamic';

export default async function BirthdaysPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const clients = await getClients();
  // «Сегодня» в Алматы как календарные компоненты (как в lib/calendar.ts).
  const w = toAlmaty(new Date());
  const today: Today = {year: w.getFullYear(), month: w.getMonth(), day: w.getDate()};

  return (
    <div className="h-screen overflow-auto">
      <BirthdaysView clients={clients} today={today} />
    </div>
  );
}
