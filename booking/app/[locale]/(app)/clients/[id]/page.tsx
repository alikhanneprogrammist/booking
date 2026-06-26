import {setRequestLocale} from 'next-intl/server';
import ClientCard from '@/components/clients/ClientCard';
import {getClientById, getClientBookings, getResources} from '@/lib/queries';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);

  const [client, history, resources] = await Promise.all([
    getClientById(id),
    getClientBookings(id),
    getResources(),
  ]);

  return <ClientCard id={id} client={client} history={history} resources={resources} />;
}
