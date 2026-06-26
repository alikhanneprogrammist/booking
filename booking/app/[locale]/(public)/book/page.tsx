import {getTranslations, setRequestLocale} from 'next-intl/server';
import {getResources, getSettings} from '@/lib/queries';
import BookingRequestForm from './BookingRequestForm';

// Данные объектов и тексты страницы читаем из БД на каждый запрос.
export const dynamic = 'force-dynamic';

export default async function PublicBookPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('publicBooking');

  const [resourcesRaw, settings] = await Promise.all([getResources(), getSettings()]);
  const resources = resourcesRaw
    .filter((r) => r.isActive)
    .map((r) => ({
      id: r.id,
      nameRu: r.nameRu,
      nameKk: r.nameKk,
      capacity: r.capacity,
    }));

  // Тексты из настроек (админка) с откатом на i18n-дефолт, если поле пустое.
  const isKk = locale === 'kk';
  const company = settings.companyName || 'OFFICE 2020';
  const title = (isKk ? settings.publicTitleKk : settings.publicTitleRu) || t('title');
  const subtitle = (isKk ? settings.publicSubtitleKk : settings.publicSubtitleRu) || t('subtitle');
  const info = isKk ? settings.publicInfoKk : settings.publicInfoRu;
  const contacts = settings.publicContacts;
  const prepay = settings.prepaymentPercent;

  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
          )}
          <div className="text-base font-semibold tracking-tight">{company}</div>
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>

        {(info || prepay > 0) && (
          <div className="mt-3 space-y-1.5 rounded-lg bg-subtle p-3 text-sm text-muted">
            {info && <p className="whitespace-pre-line">{info}</p>}
            {prepay > 0 && <p>{t('prepaymentNote', {percent: prepay})}</p>}
          </div>
        )}

        <BookingRequestForm resources={resources} />

        {contacts && (
          <p className="mt-6 border-t border-border pt-4 text-center text-xs text-muted">
            {t('contacts')}: {contacts}
          </p>
        )}
      </div>
    </div>
  );
}
