import {setRequestLocale} from 'next-intl/server';
import {requireAdmin} from '@/lib/auth-helpers';
import PublicContentForm from '@/components/admin/PublicContentForm';
import {getSettings} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function PublicContentPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const settings = await getSettings();

  return <PublicContentForm settings={settings} />;
}
