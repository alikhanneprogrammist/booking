// Минимальный service worker — нужен только для «устанавливаемости» PWA в Android Chrome
// (требуется наличие fetch-обработчика). Офлайн-кэша нет: запросы идут в сеть как обычно.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Намеренно пусто — отдаём управление браузеру (без respondWith → обычная загрузка).
});
