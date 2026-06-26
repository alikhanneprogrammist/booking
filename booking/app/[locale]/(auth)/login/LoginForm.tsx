'use client';

import {useFormState, useFormStatus} from 'react-dom';
import {useLocale, useTranslations} from 'next-intl';
import {authenticate} from './actions';

function SubmitButton() {
  const t = useTranslations('auth');
  const {pending} = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? t('loading') : t('submit')}
    </button>
  );
}

export default function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [errorCode, action] = useFormState(authenticate, undefined);

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('phone')}</span>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="username"
          placeholder="+7 700 000 00 00"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">{t('password')}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
      </label>

      {errorCode && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
          {t('error')}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
