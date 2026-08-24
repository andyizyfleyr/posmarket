# Plan — Cache serveur & CDN (réduction drastique des lectures DB)

**Contexte** : le quota de transfert Neon a été épuisé par les tests de charge car chaque
régénération de page interrogeait la DB. Objectif : ne solliciter Neon qu'au minimum,
côté Data Cache Next.js **et** côté CDN Vercel.

## Étapes

- [x] 1. Lire la doc Next 16 (`unstable_cache`, route segment config) — APIs confirmées disponibles
- [x] 2. **Data Cache** : wrapper `fetchMarketplaceData()` dans `unstable_cache`
      (clé `marketplace-catalog`, tag `marketplace`, `revalidate: 300`)
- [x] 3. **Invalidation** : appeler `updateTag('marketplace')` après chaque mutation catalogue :
      - `src/app/actions/inventory.ts` — saveProductAction, deleteProductAction, bulkDeleteProductsAction
      - `src/app/actions/settings.ts` — updateStoreSettingsAction, createStoreAction, deleteStoreAction
      - `src/app/actions/store.ts` — suppression boutique + quickCreateStoreAction
      - `src/app/actions/admin.ts` — forceDeleteStore (admin)
      - `src/db/query.ts` — insert/update/delete génériques sur stores/products (wrapper supabase)
      - `saveProductReviewAction` (stats affichées dans le catalogue)
      - ⚠️ API spécifique Next 16 : `updateTag(tag)` (1 argument) au lieu de
        `revalidateTag(tag, profile)` — recommandé dans les Server Actions (read-your-writes)
      - ⚠️ Ne PAS invalider sur les incréments de vues (stats tolérées obsolètes) ✓ confirmé :
        les RPC increment_*_views dans query.ts n'invalident rien
- [x] 4. **Cache CDN images** : `export const revalidate = 86400` sur `/api/image/[id]/route.ts`
      (le handler ne tourne qu'une fois par image/jour, ensuite réponse servie par Vercel)
- [x] 5. **Page-level ISR** : conserver `revalidate = 60` existant sur la home (déjà actif)
- [x] 6. Vérification : `npx tsc --noEmit` OK (eslint timeout environnemental connu, non bloquant)
- [ ] 7. Commit + push

## Effet attendu

| Couche | Avant | Après |
|---|---|---|
| Régénération page | 1 requête SQL complète à chaque revalidation (60s/page) | 1 requête / 5 min max, partagée entre toutes les pages |
| Mutations vendeur | — | Catalogue à jour en < 1s via revalidateTag |
| Images `/api/image/*` | 1 requête DB par hit sans cache navigateur | 1 requête DB / image / jour (CDN) |
