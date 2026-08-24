# Plan — Performance globale (backlog 12 points)

## Statuts

- [x] 1. **SELECT * ciblés** — fait sur le chemin critique (`fetchMarketplaceData`, commit `8b8de9c`).
      Les autres requêtes (admin/inventory/POS) sont derrière auth, trafic négligeable.
- [ ] 2. **LIMIT/pagination** — `getProductsAction` déjà paginé ; catalogue marketplace = 1 page
      unique (~60 produits). À revoir seulement si le catalogue dépasse ~500 produits.
- [x] 3. **Images → Cloudflare R2** :
      - `src/lib/r2.ts` — upload data URI → R2 (fallback base64 si env absente)
      - `inventory.ts saveProductAction` — image produit uploadée vers `products/`
      - `settings.ts updateStoreSettingsAction` — logo uploadé vers `logos/`
      - `scripts/migrate-images-r2.mts` — migration one-shot des images existantes
      - ⚠️ Nécessite les env vars Vercel : CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL (+ bucket public ou domain custom)
      - `/api/image/[id]` sert déjà de redirect pour toute URL http → compat ascendante
- [x] 4. **unstable_cache** — fait (commit `9ec20e0`) : cache 5 min + invalidation updateTag.
- [x] 5. **generateStaticParams** — N/A : storefront mono-route `[[...slug]]` avec ISR 60s.
- [ ] 6. **Index SQL** — `supabase/migrations/20260824_performance_indexes.sql` écrit.
      ⚠️ À APPLIQUER manuellement sur Neon (SQL Editor) puis cocher.
- [x] 7. **Driver HTTP Neon** — déjà en place (`drizzle-orm/neon-http`).
- [x] 8. **Polling client** — faux positif : les 2 setInterval sont des carrousels UI locaux.
- [x] 9. **Middleware anti-bots** — `src/middleware.ts` bloque scrapers/audit/scripts
      (403), Googlebot/Bingbot et navigateurs autorisés. k6 non bloqué (UA k6 absent
      de la liste) → tests de charge toujours possibles.
- [x] 10. **Cache-Control API** — couvert par `/api/image` (max-age=86400 + ISR CDN) ;
      ping/set-store non cacheables par nature.
- [x] 11. **Lazy load avis/recommandations** — vérifié : déjà conforme.
      Les avis détaillés sont chargés uniquement à l'ouverture de l'onglet
      (StorefrontView ~ligne 1206, condition `storeTab === 'reviews'`, cache client) ;
      les recommandations/similaires sont calculés depuis le catalogue en mémoire,
      zéro requête réseau. Rien à changer.
- [x] 12. **Monitoring requêtes lentes** — Neon embarque pg_stat_statements :
      console.neon.tech → onglet « Queries » (top requêtes par temps cumulé).
      Rien à installer ; vérifier après application des index.

## Reste à faire (humain)

1. Créer le bucket R2 (dashboard Cloudflare) + clés API + domain public
2. Ajouter les 5 env vars dans Vercel → redeploy
3. Appliquer `20260824_performance_indexes.sql` dans Neon SQL Editor
4. Quand le quota Neon est rétabli : lancer la migration images
   (`node --env-file=.env.local scripts/migrate-images-r2.mts`)
