import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { QueryBuilder, runQuery } from '@/db/query';
import { getCurrentSession } from '@/app/actions/session';

async function getCurrentUser() {
  try {
    const { user } = await getCurrentSession();
    if (!user) {
      return { user: null };
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return { user: null };
    }

    // Un compte acheteur ne doit jamais être retourné comme session vendeur valide
    if (profile.accountType === 'buyer' && !profile.isSuperAdmin) {
      return { user: null };
    }

    return {
      user: {
        id: profile.id,
        email: profile.email,
        user_metadata: { full_name: profile.fullName, account_type: profile.accountType },
      },
    };
  } catch {
    return { user: null };
  }
}

export async function createClient() {
  return {
    auth: {
      async getUser() {
        const { user } = await getCurrentUser();
        return { data: { user }, error: null };
      },
      async getSession() {
        const { user } = await getCurrentUser();
        return { data: { session: user ? { user } : null }, error: null };
      },
    },
    from(table: string) {
      return new QueryBuilder(table, runQuery);
    },
  };
}