import {setRequestLocale} from 'next-intl/server';
import ClientsView from '@/components/clients/ClientsView';
import {getClients, getVisitCounts} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const [clients, visits] = await Promise.all([getClients(), getVisitCounts()]);

  return (
    <div className="h-screen">
      <ClientsView clients={clients} visits={visits} />
    </div>
  );
}
