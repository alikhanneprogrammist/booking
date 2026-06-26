import {setRequestLocale} from 'next-intl/server';
import {requireAdmin} from '@/lib/auth-helpers';
import SettingsForm from '@/components/admin/SettingsForm';
import {getSettings} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const settings = await getSettings();

  return <SettingsForm settings={settings} />;
}
