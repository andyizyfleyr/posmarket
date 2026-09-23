import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import Email from 'next-auth/providers/email';
import Google from 'next-auth/providers/google';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { authConfig } from '@/lib/auth.config';
import { authAdapter } from '@/db/auth-adapter';
import { sendMagicLinkEmail } from '@/lib/email';
import { ensureAuthProfile, linkGoogleAccount } from '@/lib/auth-signin';

// Session "illimitée" : on garde l'utilisateur connecté jusqu'à déconnexion.
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 10;

const providers: NextAuthConfig['providers'] = [
  Email({
    maxAge: 60 * 10,
    // La vérification de construction du provider requiert `server` (présence
    // uniquement) ; l'envoi effectif passe par sendMagicLinkEmail + config SMTP
    // de la table system_settings.
    server: { host: 'localhost', port: 25, auth: { user: '', pass: '' } },
    async sendVerificationRequest({ identifier: email, url }) {
      await sendMagicLinkEmail({ to: email, url });
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE, updateAge: 24 * 60 * 60 },
  adapter: authAdapter,
  providers,
  // IMPORTANT : `...authConfig` remplace `callbacks` en bloc au niveau racine.
  // On fusionne explicitement `session` d'authConfig avec signIn/jwt ci-dessous.
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, email }) {
      if (!user?.email) return false;
      try {
        // `verificationRequest` n'est présent que lors de la DEMANDE de lien ;
        // l'email n'est marqué vérifié qu'au clic sur le lien (ou retour Google).
        const profile = await ensureAuthProfile({
          email: user.email,
          name: user.name ?? null,
          markVerified: account?.provider !== 'email' || email?.verificationRequest !== true,
        });
        if (profile && account?.provider === 'google') {
          await linkGoogleAccount({
            userId: profile.id,
            providerAccountId: String(user.id || ''),
          });
        }
        return true;
      } catch (error) {
        console.error('auth.signIn callback failed', error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user?.id) {
        try {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, String(user.id)))
            .limit(1);
          if (profile) {
            token.id = profile.id;
            token.email = profile.email;
            token.name = profile.fullName ?? undefined;
            token.picture = profile.avatarUrl ?? undefined;
            token.accountType = profile.accountType || 'buyer';
            token.isSuperAdmin = profile.isSuperAdmin;
          }
        } catch {
          // Conservation du token existant en cas d'échec de lecture du profil.
        }
      }
      return token;
    },
  },
});