import {setRequestLocale} from 'next-intl/server';
import {requireAdmin} from '@/lib/auth-helpers';
import UsersView from '@/components/users/UsersView';
import {getUsers} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireAdmin(); // FR-AUTH-5: серверная проверка роли

  const users = await getUsers();

  return <UsersView users={users} />;
}
