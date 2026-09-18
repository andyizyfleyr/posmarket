'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notify, getAdminPhones } from '@/lib/notifications';

export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  
  try {
    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    
    if (!profile) {
      return { error: "Aucun compte vendeur trouvé avec cet email. Veuillez créer un compte commerçant." };
    }

    // Un compte acheteur ne peut JAMAIS se connecter à l'espace vendeur
    if (profile.accountType === 'buyer' && !profile.isSuperAdmin) {
      return { 
        error: "Ce compte est un compte client (acheteur). Vous ne pouvez pas l'utiliser pour accéder à l'espace vendeur. Veuillez créer un compte vendeur avec un autre email." 
      };
    }

    (await cookies()).set('userId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    redirect('/dashboard');
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('NEXT_REDIRECT')) throw error;
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function signupAction(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  
  try {
    const [existing] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing) {
      if (existing.accountType === 'buyer') {
        return { 
          error: "Cet email est déjà associé à un compte client (acheteur). Vous ne pouvez pas l'utiliser pour créer un compte vendeur. Veuillez utiliser un autre email." 
        };
      }
      return { 
        error: "Un compte vendeur existe déjà avec cet email. Veuillez vous connecter." 
      };
    }

    const [newProfile] = await db.insert(profiles).values({
      email,
      fullName: name,
      accountType: 'seller',
    }).returning();

    (await cookies()).set('userId', newProfile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });

    const adminPhones = await getAdminPhones();
    for (const adminPhone of adminPhones) {
      await notify({
        userId: null,
        phone: adminPhone,
        eventType: 'NOUVELLE_INSCRIPTION',
        title: 'Nouvelle inscription',
        body: `Nouveau commerçant inscrit sur PosMarket : ${name} (${email}).`,
        templateParams: [name || '', email],
      });
    }

    redirect('/subscription');
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes('NEXT_REDIRECT')) throw error;
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('userId');
  cookieStore.delete('buyerUserId');
  cookieStore.delete('pos_current_store_id');
  cookieStore.delete('storeId');
  return { success: true };
}
