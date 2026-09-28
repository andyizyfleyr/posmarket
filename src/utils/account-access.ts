import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, stores, storeStaff } from '@/db/schema';

/**
 * Résolution d'accès shared par l'espace vendeur (`(app)`) et l'espace compte
 * acheteur (`/mon-compte`).
 *
 * Les deux espaces s'excluent : une seule résolution alimente les deux gardes,
 * ce qui évite qu'un utilisateur soit renvoyé en boucle de l'un vers l'autre.
 */
export type AccountSpace = 'anonymous' | 'admin' | 'seller' | 'buyer' | 'none';

export interface AccountAccess {
  space: AccountSpace;
  profile: typeof profiles.$inferSelect | null;
  /** Boutiques possédées (propriétaire). */
  ownedStores: Array<typeof stores.$inferSelect>;
  /** Boutiques où l'utilisateur est membre de l'équipe. */
  staffStores: Array<typeof stores.$inferSelect>;
  staffEntries: Array<typeof storeStaff.$inferSelect>;
}

/**
 * Détermine l'espace auquel appartient un utilisateur.
 *
 * `profiles.accountType` est l'unique source de vérité : un compte acheteur
 * reste acheteur, un compte vendeur reste vendeur, définitivement. La
 * possession d'une boutique ne promeut PAS un acheteur en vendeur — c'est
 * l'inverse qui compte : si les deux se contredisent, l'incohérence doit
 * remonter à l'administration (PAM) au lieu d'être silencieusement résolue.
 */
export async function resolveAccountAccess(userId: string | null | undefined): Promise<AccountAccess> {
  const empty: AccountAccess = {
    space: 'anonymous',
    profile: null,
    ownedStores: [],
    staffStores: [],
    staffEntries: [],
  };

  if (!userId) return empty;

  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) return empty;

    const [ownedStores, staffEntries] = await Promise.all([
      db.select().from(stores).where(eq(stores.userId, userId)).catch(() => []),
      db.select().from(storeStaff).where(eq(storeStaff.userId, userId)).catch(() => []),
    ]);

    const staffStoreIds = staffEntries.map((entry) => entry.storeId);
    const staffStores = staffStoreIds.length
      ? await db
          .select()
          .from(stores)
          .where(inArray(stores.id, staffStoreIds))
          .catch(() => [])
      : [];

    const isAdmin = profile.isSuperAdmin || profile.accountType === 'admin';
    const accountType = profile.accountType || 'buyer';

    let space: AccountSpace;
    if (isAdmin) space = 'admin';
    else if (accountType === 'seller') space = 'seller';
    else if (accountType === 'buyer') space = 'buyer';
    else space = 'none';

    // Un acheteur (ou un compte sans type) rattaché à une boutique est une
    // incohérence de données : on le signale plutôt que d'élargir son accès.
    if (space !== 'seller' && space !== 'admin' && (ownedStores.length > 0 || staffEntries.length > 0)) {
      console.warn(
        `[account-access] Incohérence : profil ${userId} de type "${accountType}" est rattaché à une boutique ` +
          `(${ownedStores.length} possédée(s), ${staffEntries.length} équipe(s)). ` +
          `Accès maintenu sur "${space}". Corriger le type de compte depuis /pam/users/${userId}.`
      );
    }

    return { space, profile, ownedStores, staffStores, staffEntries };
  } catch {
    // Une résolution en échec ne doit jamais ouvrir un espace : on retombe sur
    // « aucun accès » et les gardes renverront vers la page de connexion.
    return empty;
  }
}

/** Espace d'atterrissage d'un compte, utilisé par les redirections. */
export function landingPathFor(space: AccountSpace): string {
  switch (space) {
    case 'admin':
      return '/pam';
    case 'seller':
      return '/dashboard';
    case 'buyer':
    case 'none':
    case 'anonymous':
      return '/mon-compte';
    default:
      return '/mon-compte';
  }
}

/** Un compte peut-il atteindre l'espace vendeur ? */
export function canAccessSellerSpace(space: AccountSpace): boolean {
  return space === 'seller';
}

/** Un compte peut-il atteindre l'espace acheteur `/mon-compte` ? */
export function canAccessBuyerSpace(space: AccountSpace): boolean {
  return space === 'buyer' || space === 'none';
}
