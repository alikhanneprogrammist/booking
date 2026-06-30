import type {MetadataRoute} from 'next';

// Web App Manifest → отдаётся по /manifest.webmanifest, ссылку Next вставляет сам.
// Делает сайт «устанавливаемым»: «Добавить на главный экран» (iOS Safari / Android Chrome)
// создаёт иконку-приложение, которое открывается в полноэкранном (standalone) режиме.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OFFICE 2020 — Бронирование',
    short_name: 'OFFICE 2020',
    description: 'Система брони и управления ресурсами OFFICE 2020',
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
