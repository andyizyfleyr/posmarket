import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { QueryBuilder, runQuery } from '@/db/query';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  if (!userId) {
    return { user: null };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile) {
    return { user: null };
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      user_metadata: { full_name: profile.fullName },
    },
  };
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
