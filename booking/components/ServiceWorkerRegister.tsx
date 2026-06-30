'use client';

import {useEffect} from 'react';

// Регистрирует /sw.js (см. public/sw.js) — включает установку PWA на Android.
// На iOS service worker для «На главный экран» не требуется (хватает манифеста + apple-иконки).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
