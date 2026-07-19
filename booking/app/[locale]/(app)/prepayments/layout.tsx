import {currentUser} from '@/lib/auth-helpers';

// Журнал предоплат — для всех сотрудников (менеджеры вносят предоплаты вручную).
// Неавторизованных отсекает middleware; здесь серверный дубль-гард.
export default async function PrepaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) throw new Error('FORBIDDEN: требуется вход');
  return <>{children}</>;
}
