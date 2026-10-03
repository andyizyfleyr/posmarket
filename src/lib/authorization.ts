import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, stores, storeStaff } from '@/db/schema';
import { createClient } from '@/utils/supabase/server';
import { getAdminSession, type AdminSession } from '@/app/actions/admin-auth';

/**
 * Garde-fous d'autorisation partagés par les server actions.
 *
 * Toute action qui touche une donnée doit passer par l'un de ces contrôles.
 * Une action sans contrôle est appelable par n'importe quel visiteur : les
 * server actions sont des endpoints HTTP, l'absence de vérification ici
 * équivaut à une absence d'authentification.
 *
 * Ce module ne doit jamais être importé par un composant client.
 */

export type AccessResult =
  | { ok: true; userId: string; isSuperAdmin: boolean; storeIds: string[] }
  | { ok: false; error: string };

/** Identifiant de l'utilisateur authentifié (Auth.js), ou null. */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ? String(data.user.id) : null;
  } catch {
    return null;
  }
}

/** Session de l'espace d'administration /pam (cookie signé). */
export async function getPamAdmin(): Promise<AdminSession | null> {
  try {
    return await getAdminSession();
  } catch {
    return null;
  }
}

/** Boutiques que l'utilisateur peut gérer : propriétaire ou membre d'équipe. */
export async function getManageableStoreIds(userId: string): Promise<string[]> {
  const [owned, staff] = await Promise.all([
    db.select({ id: stores.id }).from(stores).where(eq(stores.userId, userId)),
    db.select({ storeId: storeStaff.storeId }).from(storeStaff).where(eq(storeStaff.userId, userId)),
  ]);
  return Array.from(new Set<string>([...owned.map((r) => r.id), ...staff.map((r) => r.storeId)]));
}

/**
 * Contrôle d'accès complet : authentification + rôle + périmètre boutique.
 * Retourne aussi la liste des boutiques gérables, réutilisée pour
 * contraindre les requêtes génériques (voir `runQuery`).
 */
export async function authorizeSeller(): Promise<AccessResult> {
  const userId = await getAuthUserId();
  if (!userId) return { ok: false, error: 'Non authentifié' };

  const [profile] = await db
    .select({ isSuperAdmin: profiles.isSuperAdmin, accountType: profiles.accountType })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  // Le compte PAM (admin_users) n'est pas un profil : on le laisse passer, ses
  // actions passent par `requirePamAdmin` et non par ce chemin.
  if (!profile) return { ok: false, error: 'Profil introuvable' };

  const isSuperAdmin = !!profile.isSuperAdmin;
  const storeIds = await getManageableStoreIds(userId);
  return { ok: true, userId, isSuperAdmin, storeIds };
}

/** Vérifie qu'un utilisateur a le droit d'agir sur cette boutique. */
export async function requireStoreAccess(storeId: string): Promise<AccessResult> {
  const access = await authorizeSeller();
  if (!access.ok) return access;
  if (!storeId) return { ok: false, error: 'Boutique inconnue' };
  if (access.isSuperAdmin || access.storeIds.includes(storeId)) {
    return access;
  }
  return { ok: false, error: "Vous n'avez pas accès à cette boutique" };
}

/** Vérifie que `userId` est bien l'appelant (ou qu'il est super admin). */
export async function requireSelfOrAdmin(userId: string): Promise<AccessResult> {
  const caller = await getAuthUserId();
  if (!caller) return { ok: false, error: 'Non authentifié' };
  if (caller !== userId) {
    const [profile] = await db
      .select({ isSuperAdmin: profiles.isSuperAdmin })
      .from(profiles)
      .where(eq(profiles.id, caller))
      .limit(1);
    if (!profile?.isSuperAdmin) return { ok: false, error: ACCES_REFUSE };
    return { ok: true, userId: caller, isSuperAdmin: true, storeIds: await getManageableStoreIds(caller) };
  }
  return { ok: true, userId: caller, isSuperAdmin: false, storeIds: await getManageableStoreIds(caller) };
}

/** Message unique pour les refus d'accès, afin de ne pas divulguer le détail. */
export const ACCES_REFUSE = 'Accès refusé.';

/** Variante renvoyant une erreur « non autorisé » explicite. */
export const FORBIDDEN = "Vous n'avez pas l'autorisation nécessaire pour cette action.";
