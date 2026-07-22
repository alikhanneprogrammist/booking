import {currentUser} from '@/lib/auth-helpers';

// Журнал внутренней доставки — для всех сотрудников (менеджеры вносят заказы).
// Неавторизованных отсекает middleware; здесь серверный дубль-гард.
export default async function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) throw new Error('FORBIDDEN: требуется вход');
  return <>{children}</>;
}
