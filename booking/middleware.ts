import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import {NextResponse} from 'next/server';
import {authConfig} from './auth.config';
import {routing} from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const {auth} = NextAuth(authConfig);

const LOCALE_RE = /^\/(ru|kk)(\/.*)?$/;
// Все админ-разделы теперь под /settings (Заведение/Объекты/Сотрудники/Публичная страница).
const ADMIN_PREFIXES = ['/settings'];
// Публичные пути (без логина): страница входа и виджет заявок клиента.
const PUBLIC_PATHS = ['/login', '/book'];

/** Снимает префикс локали: /ru/calendar → /calendar, /kk → / */
function stripLocale(pathname: string): string {
  const m = pathname.match(LOCALE_RE);
  return m ? m[2] || '/' : pathname;
}

export default auth((req) => {
  const {nextUrl} = req;
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role;

  const path = stripLocale(nextUrl.pathname);
  const locale = nextUrl.pathname.match(LOCALE_RE)?.[1] ?? routing.defaultLocale;
  const isLoginPage = path === '/login';
  const isPublic = PUBLIC_PATHS.includes(path);

  // FR-AUTH-3: неавторизованный → /login (кроме публичных страниц: логин, /book).
  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/login`, nextUrl));
  }

  // Уже вошёл и открывает /login → на календарь.
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(`/${locale}/calendar`, nextUrl));
  }

  // FR-AUTH-5 (барьер middleware): админ-разделы только для ADMIN.
  if (isLoggedIn && role !== 'ADMIN' && ADMIN_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL(`/${locale}/calendar`, nextUrl));
  }

  // i18n-роутинг (локаль-префикс, переключение языка).
  return intlMiddleware(req);
});

export const config = {
  matcher: ['/', '/(ru|kk)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
