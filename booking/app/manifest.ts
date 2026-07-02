import type {MetadataRoute} from 'next';
import {getSettings} from '@/lib/queries';

// Web App Manifest → отдаётся по /manifest.webmanifest, ссылку Next вставляет сам.
// Делает сайт «устанавливаемым»: «Добавить на главный экран» (iOS Safari / Android Chrome)
// создаёт иконку-приложение, которое открывается в полноэкранном (standalone) режиме.

// Имя берём из настроек заведения на каждый запрос (ребрендинг без пересборки).
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let company = 'OFFICE 2020';
  try {
    company = (await getSettings()).companyName || company;
  } catch {
    // БД недоступна (например, при сборке образа) — статичный фолбэк.
  }
  return {
    name: `${company} — Бронирование`,
    short_name: company,
    description: `Система брони и управления ресурсами ${company}`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#6366f1',
    lang: 'ru',
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
  };
}
