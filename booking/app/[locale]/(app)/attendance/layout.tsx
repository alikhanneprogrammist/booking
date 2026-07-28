import {currentUser} from '@/lib/auth-helpers';

// «Посещаемость» — для всех сотрудников (отчёт вели менеджеры в экселе).
// Неавторизованных отсекает middleware; здесь серверный дубль-гард.
export default async function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) throw new Error('FORBIDDEN: требуется вход');
  return <>{children}</>;
}
