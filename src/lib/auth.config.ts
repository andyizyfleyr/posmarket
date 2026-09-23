import type { NextAuthConfig } from 'next-auth';

/**
 * Configuration edge-safe partagée entre le nœud (auth.ts) et le proxy.
 * Aucun accès base de données ici : les revendications sont stockées dans le
 * JWT à la connexion (callback jwt côté nœud) puis relues par `session`.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  providers: [],
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = String(token.id);
        if (token.email) session.user.email = String(token.email);
        if (token.name) session.user.name = String(token.name);
        session.user = {
          ...session.user,
          id: token.id ? String(token.id) : session.user.id,
          accountType: (token.accountType as string) ?? 'buyer',
          isSuperAdmin: Boolean(token.isSuperAdmin),
        } as typeof session.user;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;