import {getTranslations, setRequestLocale} from 'next-intl/server';
import LoginForm from './LoginForm';

export default async function LoginPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-base font-semibold tracking-tight">OFFICE&nbsp;2020</div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        <LoginForm />
      </div>
    </div>
  );
}
