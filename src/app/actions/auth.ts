'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  
  try {
    let [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    
    if (!profile) {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      [profile] = await db.insert(profiles).values({
        email,
        fullName: email.split('@')[0],
        subscriptionTier: 'PRO',
        subscriptionDuration: 'monthly',
        subscriptionStatus: 'ACTIVE',
        subscriptionStartDate: now,
        subscriptionEndDate: endOfMonth,
      }).returning();
    }

    (await cookies()).set('userId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/dashboard');
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('NEXT_REDIRECT')) throw error;
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function signupAction(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  
  try {
    const [existing] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing) {
      (await cookies()).set('userId', existing.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
      redirect('/dashboard');
    }

    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [newProfile] = await db.insert(profiles).values({
      email,
      fullName: name,
      subscriptionTier: 'PRO',
      subscriptionDuration: 'monthly',
      subscriptionStatus: 'ACTIVE',
      subscriptionStartDate: now,
      subscriptionEndDate: endOfMonth,
    }).returning();

    (await cookies()).set('userId', newProfile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/subscription');
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('NEXT_REDIRECT')) throw error;
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function logoutAction() {
  (await cookies()).delete('userId');
  redirect('/login');
}
