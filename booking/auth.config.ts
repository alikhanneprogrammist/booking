import type {NextAuthConfig} from 'next-auth';

/**
 * Edge-safe конфиг Auth.js (без Prisma/bcrypt) — используется в middleware.
 * Полный конфиг с Credentials-провайдером — в auth.ts (Node-рантайм).
 */
export const authConfig = {
  trustHost: true,
  session: {strategy: 'jwt'},
  pages: {signIn: '/login'},
  providers: [], // провайдер добавляется в auth.ts
  callbacks: {
    jwt({token, user}) {
      if (user) {
        token.uid = user.id as string;
        token.role = (user as {role?: 'ADMIN' | 'MANAGER'}).role;
      }
      return token;
    },
    session({session, token}) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as 'ADMIN' | 'MANAGER';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
