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
- [x] 6. **Index SQL** — `supabase/migrations/20260824_performance_indexes.sql` appliqué
      sur la NOUVELLE base Neon (8 index vérifiés via pg_indexes) pendant la migration.
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

## Reste à faire (humain) — état au 24/08/2026

Fait :
1. ~~Bucket R2 + clés + URL publique~~ ✅
2. ~~Env vars Vercel (DATABASE_URL nouvelle DB + 5 vars R2)~~ ✅ (recréées après reconstruction du projet)
3. ~~Index SQL sur la nouvelle base Neon~~ ✅
4. ~~Migration images vers R2~~ ✅ 63/63
5. ~~Migration données Supabase → Neon~~ ✅ 551 lignes
6. ~~Domaine posmarket-topaz.vercel.app réattaché au projet reconstruit~~ ✅
7. ~~next/image remotePatterns R2~~ ✅ (`fb874eb`)

Reste (dashboard uniquement, non automatisable par CLI) :
- [ ] Reconnecter GitHub au projet Vercel `posmarket`
      (Settings → Git → Connect `andyizyfleyr/posmarket`) → auto-déploiements au push
- [ ] Supprimer l'ancien projet Neon `ep-gentle-haze` (console.neon.tech)
- [ ] Supprimer le doublon Vercel `posmarket-two` (compte Matias — scope inaccessible du CLI actuel)
- [ ] Révoquer/rotater la clé service_role Supabase (`updrjzaapvbtjdnpicra`)

Reporté volontairement :
- #2 LIMIT/pagination — à traiter si le catalogue dépasse ~500 produits
