'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  
  try {
    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (!profile) {
      return { error: 'Utilisateur introuvable.' };
    }

    (await cookies()).set('userId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/dashboard');
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) throw error;
    return { error: error.message };
  }
}

export async function signupAction(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  
  try {
    const [newProfile] = await db.insert(profiles).values({
      email,
      fullName: name,
      subscriptionTier: 'PRO',
      subscriptionDuration: 'monthly',
      subscriptionStatus: 'ACTIVE',
    }).returning();

    (await cookies()).set('userId', newProfile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/subscription');
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) throw error;
    return { error: error.message };
  }
}

export async function logoutAction() {
  (await cookies()).delete('userId');
  redirect('/login');
}
