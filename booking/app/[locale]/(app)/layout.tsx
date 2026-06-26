import {getTranslations} from 'next-intl/server';
import Sidebar from '@/components/Sidebar';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import {currentUser} from '@/lib/auth-helpers';
import {getSettings} from '@/lib/queries';
import {doSignOut} from '@/lib/auth-actions';

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const user = await currentUser();
  const isAdmin = user?.role === 'ADMIN';
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 px-5 py-4 text-sm font-semibold tracking-tight">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
          )}
          <span className="truncate">{settings.companyName || 'OFFICE 2020'}</span>
        </div>
        <Sidebar isAdmin={isAdmin} />
        <div className="mt-auto border-t border-border px-4 py-3">
          {user && (
            <div className="mb-2 truncate text-xs text-muted">
              {user.name} · {user.role}
            </div>
          )}
          <div className="flex items-center justify-between">
            <LocaleSwitcher />
            <form action={doSignOut}>
              <button
                type="submit"
                className="text-xs font-medium text-muted hover:text-foreground"
              >
                {t('nav.logout')}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
