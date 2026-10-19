'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signIn, signOut } from '@/auth';
import { setAuthIntentCookie, googleErrorToMessage } from '@/lib/auth-signin';
import { sendMagicLinkForSeller } from '@/lib/seller-magic-link';

export async function loginAction(formData: FormData) {
  const email = String((formData.get('email') as string) || '').trim().toLowerCase();
  const result = await sendMagicLinkForSeller({ email, target: '/dashboard', register: false });
  if ('error' in result) {
    return { error: result.error };
  }
  // Le lien est envoyé ; l'utilisateur se connectera en cliquant dessus.
  return { success: true, message: `Lien de connexion envoyé à ${result.email}. Vérifiez votre boîte mail.` };
}

export async function signupAction(formData: FormData) {
  const name = String((formData.get('name') as string) || '').trim();
  const email = String((formData.get('email') as string) || '').trim().toLowerCase();
  if (!name) {
    return { error: 'Veuillez saisir votre nom complet.' };
  }
  const result = await sendMagicLinkForSeller({ email, name, target: '/subscription', register: true });
  if ('error' in result) {
    return { error: result.error };
  }
  return { success: true, message: `Lien de confirmation envoyé à ${result.email}. Cliquez dessus pour activer votre compte commerçant.` };
}

export async function googleSignInAction(callbackUrl?: string) {
  const target =
    typeof callbackUrl === 'string' && callbackUrl.startsWith('/')
      ? callbackUrl
      : '/dashboard';
  await setAuthIntentCookie({ intent: 'seller' });
  const result = await signIn('google', { redirect: false, callbackUrl: target });
  if (!result?.url) {
    const code = (result as { code?: string } | null | undefined)?.code;
    return { error: googleErrorToMessage(code) };
  }
  // Navigation externe : emmène l'utilisateur vers l'écran Google.
  redirect(result.url);
}

export async function logoutAction() {
  await signOut({ redirect: false });
  const cookieStore = await cookies();
  cookieStore.delete('userId');
  cookieStore.delete('buyerUserId');
  cookieStore.delete('pos_current_store_id');
  cookieStore.delete('storeId');
  cookieStore.delete('auth_intent');
  return { success: true };
}