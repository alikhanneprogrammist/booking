import type {Metadata} from 'next';
import localFont from 'next/font/local';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import '../globals.css';

// Самохостинг Inter (variable, latin+cyrillic) — сборка не зависит от Google Fonts.
// Файлы: app/fonts/ (источник: @fontsource-variable/inter).
const inter = localFont({
  src: [
    {path: '../fonts/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal'},
    {path: '../fonts/inter-cyrillic-wght-normal.woff2', weight: '100 900', style: 'normal'},
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OFFICE 2020 — Бронирование',
  description: 'Система онлайн-брони и управления ресурсами OFFICE 2020',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
