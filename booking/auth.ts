import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {authConfig} from './auth.config';
import {prisma} from './lib/db';
import {normalizePhone} from './lib/phone';

const loginSchema = z.object({
  phone: z.string().min(3),
  password: z.string().min(1),
});

export const {handlers, auth, signIn, signOut} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {phone: {}, password: {}},
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const phone = normalizePhone(parsed.data.phone);
        const user = await prisma.user.findUnique({where: {phone}});

        // FR-AUTH-4: деактивированный сотрудник войти не может.
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {id: user.id, name: user.name, role: user.role};
      },
    }),
  ],
});
