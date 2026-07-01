import {requireAdmin} from '@/lib/auth-helpers';

// Аналитика содержит выручку — только для ADMIN (гард здесь + в middleware).
export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // FR-AUTH-5: серверная проверка роли
  return <>{children}</>;
}
