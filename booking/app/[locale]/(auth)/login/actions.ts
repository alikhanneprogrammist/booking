'use server';

import {AuthError} from 'next-auth';
import {signIn} from '@/auth';

/** Серверный экшен входа. Возвращает код ошибки ('error') или редиректит. */
export async function authenticate(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const locale = (formData.get('locale') as string) || 'ru';
  try {
    await signIn('credentials', {
      phone: formData.get('phone'),
      password: formData.get('password'),
      redirectTo: `/${locale}/calendar`,
    });
  } catch (error) {
    if (error instanceof AuthError) return 'error';
    throw error; // NEXT_REDIRECT и прочее — пробрасываем
  }
  return undefined;
}
