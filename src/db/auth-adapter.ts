import { db } from '@/db';
import { profiles, verificationTokens, accounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Adapter, AdapterUser, VerificationToken } from 'next-auth/adapters';

function toAdapterUser(p: typeof profiles.$inferSelect): AdapterUser {
  return {
    id: p.id,
    name: p.fullName ?? null,
    email: p.email,
    image: p.avatarUrl ?? null,
    emailVerified: p.emailVerified,
  };
}

/**
 * Adapter Auth.js minimaliste (stratégie JWT + magic link + Google).
 * Les méthodes user/verification couvrent le provider Email ; accounts couvre
 * la liaison Google sans duplication de profil.
 */
export const authAdapter: Adapter = {
  createUser: async (user) => {
    const email = String(user.email || '').trim().toLowerCase();
    const [existing] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    // Ne jamais dupliquer un profil par email (fusion des méthodes de connexion).
    if (existing) return toAdapterUser(existing);
    const [created] = await db
      .insert(profiles)
      .values({
        email,
        fullName: user.name ?? null,
        avatarUrl: user.image ?? null,
        accountType: 'buyer',
        emailVerified: user.emailVerified ?? null,
      })
      .returning();
    return toAdapterUser(created);
  },

  getUser: async (id) => {
    const [p] = await db.select().from(profiles).where(eq(profiles.id, String(id))).limit(1);
    return p ? toAdapterUser(p) : null;
  },

  getUserByEmail: async (email) => {
    const clean = String(email || '').trim().toLowerCase();
    const [p] = await db.select().from(profiles).where(eq(profiles.email, clean)).limit(1);
    return p ? toAdapterUser(p) : null;
  },

  getUserByAccount: async ({ provider, providerAccountId }) => {
    const [row] = await db
      .select({ profile: profiles })
      .from(accounts)
      .innerJoin(profiles, eq(accounts.userId, profiles.id))
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, String(providerAccountId)),
        ),
      )
      .limit(1);
    return row ? toAdapterUser(row.profile) : null;
  },

  updateUser: async (user) => {
    if (!user.id) return toAdapterUser({ id: String(user.id) } as never);
    const [updated] = await db
      .update(profiles)
      .set({
        fullName: user.name ?? undefined,
        avatarUrl: user.image ?? undefined,
        emailVerified: user.emailVerified ?? undefined,
      })
      .where(eq(profiles.id, String(user.id)))
      .returning();
    return toAdapterUser(updated);
  },

  linkAccount: async (account) => {
    const values: typeof accounts.$inferInsert = {
      userId: String(account.userId),
      type: account.type,
      provider: account.provider,
      providerAccountId: String(account.providerAccountId),
      refreshToken: account.refresh_token ? String(account.refresh_token) : null,
      accessToken: account.access_token ? String(account.access_token) : null,
      expiresAt: account.expires_at ? Number(account.expires_at) : null,
      tokenType: account.token_type ? String(account.token_type) : null,
      scope: account.scope ? String(account.scope) : null,
      idToken: account.id_token ? String(account.id_token) : null,
      sessionState: account.session_state ? String(account.session_state) : null,
    };
    await db
      .insert(accounts)
      .values(values)
      .onConflictDoNothing({ target: [accounts.provider, accounts.providerAccountId] });
  },

  createVerificationToken: async (token) => {
    await db
      .insert(verificationTokens)
      .values({ identifier: token.identifier, token: token.token, expires: token.expires })
      .onConflictDoUpdate({
        target: [verificationTokens.identifier, verificationTokens.token],
        set: { expires: token.expires },
      });
    return token;
  },

  useVerificationToken: async ({ identifier, token }) => {
    const [row] = await db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)))
      .returning();
    return row ? (row as VerificationToken) : null;
  },
};