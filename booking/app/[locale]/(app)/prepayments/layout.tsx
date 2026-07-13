import {requireAdmin} from '@/lib/auth-helpers';

// Отчёт по предоплатам (деньги) — только для ADMIN (гард здесь + в middleware).
export default async function PrepaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
