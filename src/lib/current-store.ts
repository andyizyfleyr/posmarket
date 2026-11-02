import 'server-only';

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { storeStaff } from '@/db/schema';
import { getAccountAccess, getSessionUser } from '@/lib/request-cache';
import { getStoreCookie } from '@/utils/store-cookie';

/**
 * Résolution de la boutique courante, côté serveur.
 *
 * Remplace `getEffectiveStoreId`, qui posait jusqu'à 4 requêtes sur le chemin de
 * rendu de CHAQUE page :
 *
 *   1. cookie → vérification propriétaire (`stores`)
 *   2. cookie → vérification membre d'équipe (`store_staff`)
 *   3. repli « n'importe quelle boutique possédée »
 *   4. repli « n'importe quelle boutique de l'équipe »
 *
 * `getAccountAccess` renvoie déjà les boutiques possédées et celles dont
 * l'utilisateur est membre : ces quatre requêtes deviennent zéro. Le contrôle
 * d'accès n'est pas affaibli, il est *déplacé* — une boutique n'est retenue que
 * si elle figure dans une liste déjà autorisée, jamais parce que le client l'a
 * demandée dans un cookie.
 *
 * Aucun client base n'est accepté en paramètre, volontairement : c'est ce qui
 * avait permis au layout de relire `profiles` et `stores` par un second chemin
 * alors qu'il venait de les charger.
 */

/** Boutique courante : cookie s'il désigne une boutique autorisée, sinon repli. */
export async function resolveCurrentStoreId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const access = await getAccountAccess(user.id);

  const manageable = new Set<string>([
    ...access.ownedStores.map((s) => s.id),
    ...access.staffStores.map((s) => s.id),
  ]);

  const cookieStoreId = await getStoreCookie();
  if (cookieStoreId && manageable.has(cookieStoreId)) {
    return cookieStoreId;
  }

  // Repli déterministe, sans requête supplémentaire : la plus ancienne boutique
  // possédée, sinon la première boutique d'équipe.
  if (access.ownedStores.length > 0) {
    const [oldest] = [...access.ownedStores].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return oldest.id;
  }

  return access.staffStores.length > 0 ? access.staffStores[0].id : null;
}

export type StorePermissions = {
  permissions: Record<string, boolean>;
  role: string;
};

/**
 * Permissions de l'utilisateur courant sur une boutique.
 *
 * `getPermissionsForUser` faisait 3 requêtes : propriétaire de la boutique,
 * super administrateur, entrée d'équipe. Ici, les deux premières sont déjà
 * connues (profil et boutiques chargés par le layout). Seule l'entrée d'équipe
 * reste à lire — et uniquement pour un non-propriétaire, alors que l'ancienne
 * version interrogeait la base même pour un propriétaire.
 *
 * `fullPermissions` est passé par l'appelant : importer `FULL_PERMISSIONS` ici
 * créerait un cycle (permissions → current-store → request-cache → …).
 */
export async function resolveStorePermissions(
  storeId: string,
  fullPermissions: Record<string, boolean>,
): Promise<StorePermissions> {
  const user = await getSessionUser();
  if (!user) return { permissions: {}, role: 'SELLER' };

  const access = await getAccountAccess(user.id);

  if (access.ownedStores.some((s) => s.id === storeId) || access.profile?.isSuperAdmin) {
    return { permissions: fullPermissions, role: 'OWNER' };
  }

  const entry = access.staffEntries.find((e) => e.storeId === storeId);
  if (!entry) {
    // Ni propriétaire, ni membre : aucun droit, et surtout aucune requête.
    return { permissions: {}, role: 'SELLER' };
  }

  // `permissions` est un jsonb de `store_staff`, absent d'`AccountAccess` :
  // une seule lecture ciblée reste nécessaire.
  const [row] = await db
    .select({ permissions: storeStaff.permissions })
    .from(storeStaff)
    .where(and(eq(storeStaff.storeId, storeId), eq(storeStaff.userId, user.id)))
    .limit(1);

  const stored = (row?.permissions as Record<string, boolean> | null) ?? null;
  return {
    // Même règle qu'avant : un SELLER ne voit pas les rapports par défaut.
    permissions: stored || { ...fullPermissions, canViewReports: entry.role !== 'SELLER' },
    role: entry.role,
  };
}
