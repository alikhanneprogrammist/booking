import {auth} from '@/auth';

/** Текущий сотрудник из сессии (или null). */
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Гард админ-разделов на сервере (ТЗ FR-AUTH-5, FR-RES, FR-USER). */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN: требуется роль ADMIN');
  }
  return user;
}
