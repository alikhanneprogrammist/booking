import type {Metadata, Viewport} from 'next';
import localFont from 'next/font/local';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
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
  title: 'URS CRM — OFFICE 2020',
  description: 'URS CRM — система онлайн-брони и управления ресурсами OFFICE 2020',
  applicationName: 'URS CRM',
  // iOS: «Добавить на главный экран» → полноэкранный режим + иконка.
  appleWebApp: {capable: true, statusBarStyle: 'default', title: 'URS CRM'},
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#161B33',
  width: 'device-width',
  initialScale: 1,
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
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
