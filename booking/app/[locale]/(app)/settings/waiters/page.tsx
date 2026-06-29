import {setRequestLocale} from 'next-intl/server';
import {requireAdmin} from '@/lib/auth-helpers';
import WaitersView from '@/components/waiters/WaitersView';
import {getWaiters} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function WaitersPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireAdmin(); // FR-AUTH-5: серверная проверка роли

  const waiters = await getWaiters();

  return <WaitersView waiters={waiters} />;
}
