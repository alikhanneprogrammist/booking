import {setRequestLocale} from 'next-intl/server';
import ClientsView from '@/components/clients/ClientsView';
import {getClients, getBookings} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [clients, bookings] = await Promise.all([getClients(), getBookings()]);

  return (
    <div className="h-screen">
      <ClientsView clients={clients} bookings={bookings} />
    </div>
  );
}
