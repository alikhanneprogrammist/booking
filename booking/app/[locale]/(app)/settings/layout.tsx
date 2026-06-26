import {requireAdmin} from '@/lib/auth-helpers';
import AdminTabs from '@/components/admin/AdminTabs';

// Все админ-разделы (Заведение / Объекты / Сотрудники / Публичная страница)
// живут под /settings и делят верхние вкладки. Гард роли — здесь и в middleware.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin(); // FR-AUTH-5: серверная проверка роли

  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  );
}
