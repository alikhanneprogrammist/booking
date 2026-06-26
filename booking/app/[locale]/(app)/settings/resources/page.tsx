import {setRequestLocale} from 'next-intl/server';
import {requireAdmin} from '@/lib/auth-helpers';
import ResourcesView from '@/components/resources/ResourcesView';
import {getResources, getAddons} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireAdmin(); // FR-AUTH-5: серверная проверка роли

  const [resources, addons] = await Promise.all([getResources(), getAddons()]);

  return <ResourcesView resources={resources} addons={addons} />;
}
