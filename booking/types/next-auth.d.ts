import type {DefaultSession} from 'next-auth';

type Role = 'ADMIN' | 'MANAGER';

declare module 'next-auth' {
  interface User {
    role?: Role;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
