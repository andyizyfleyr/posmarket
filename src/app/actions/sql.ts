'use server';

import { runQuery, type QueryScope } from '@/db/query';
import { QuerySpec } from '@/db/builder';
import { authorizeSeller, getAuthUserId, getPamAdmin } from '@/lib/authorization';

/**
 * Point d'entrée générique vers la base, historiquement utilisé par le shim
 * `src/supabase.ts` pour émuler le client Supabase.
 *
 * Une server action est un endpoint HTTP : sans contrôle ici, n'importe quel
 * visiteur处置 d'un accès en lecture/écriture sur toutes les tables (élévation
 * de privilèges via `profiles`, suppression de données via un `delete` sans
 * filtre, etc.). Ces règles referment l'accès par défaut.
 */

/** Tables du catalogue public : lecture sans authentification (vitrine). */
const PUBLIC_READ_TABLES = new Set([
  'products',
  'stores',
  'categories',
  'product_stats',
  'product_reviews',
  'coupons',
]);

/**
 * Tables que ce chemin générique n'a pas le droit de modifier. Elles ont une
 * action dédiée qui vérifie le rôle et la propriété (`saveProductAction`,
 * `saveCouponAction`, `submitCheckoutAction`, actions buyer, etc.).
 */
const WRITE_DENIED_TABLES = new Set([
  'profiles',
  'stores',
  'categories',
  'products',
  'product_stats',
  'product_reviews',
  'store_staff',
  'store_stats',
  'buyer_addresses',
  'orders',
  'order_items',
  'invoices',
  'invoice_items',
]);

/** Tables modifiables par un vendeur, toujours bornées à ses boutiques. */
const SELLER_WRITABLE_TABLES = new Set(['customers', 'invoices', 'invoice_items', 'coupons']);

function denied(message: string) {
  return { data: null, error: { message } };
}

/** RPC ouvertes à tous (compteurs de vues publics). */
const PUBLIC_RPCS = new Set(['increment_product_views', 'increment_store_views']);

export async function execQuery(spec: QuerySpec) {
  // Une RPC n'a pas de table : le shim `src/supabase.ts` les construit avec un
  // nom de table vide. Sans cette délégation, le garde ci-dessous renverrait
  // « Table manquante » et figerait les compteurs de vues (produit/boutique),
  // c'est-à-dire les statistiques affichées en fiche et sur le tableau de bord.
  if (spec?.rpc) return execRpc(spec.rpc, spec.rpcArgs);

  const method = spec?.method ?? 'select';
  const table = String(spec?.table ?? '');

  if (!table) return denied('Table manquante');
  if (method !== 'select' && WRITE_DENIED_TABLES.has(table)) {
    return denied("Cette table ne peut pas être modifiée via ce point d'entrée");
  }

  if (method === 'select' && PUBLIC_READ_TABLES.has(table)) {
    // Lecture publique : le catalogue doit rester accessible sans compte.
    return runQuery(spec);
  }

  // Tout le reste exige au minimum une session valide.
  const userId = await getAuthUserId();
  if (!userId) return denied('Non authentifié');

  if (method === 'select') {
    return runQuery(spec);
  }

  // Écriture : vendeur/état-major uniquement, et borné à ses boutiques.
  const access = await authorizeSeller();
  if (!access.ok) return denied(access.error);
  if (!SELLER_WRITABLE_TABLES.has(table)) {
    return denied("Cette table ne peut pas être modifiée via ce point d'entrée");
  }
  if (!access.isSuperAdmin && access.storeIds.length === 0) {
    return denied("Vous n'avez accès à aucune boutique");
  }

  const scope: QueryScope = {
    storeIds: access.isSuperAdmin ? null : access.storeIds,
    requireFilterForWrite: true,
  };
  return runQuery(spec, scope);
}

export async function execRpc(name: string, args?: unknown) {
  const rpc = String(name ?? '');

  if (PUBLIC_RPCS.has(rpc)) {
    return runQuery({ table: '', method: 'select', rpc, rpcArgs: args });
  }

  // Le reste (création de compte staff, résolution d'un id utilisateur) est
  // réservé à l'administration.
  const admin = await getPamAdmin();
  const userId = await getAuthUserId();
  if (!admin && !userId) return denied('Non authentifié');
  if (!admin) return denied("Action réservée à l'administration");

  return runQuery({ table: '', method: 'select', rpc, rpcArgs: args });
}