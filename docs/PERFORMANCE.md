# Plan de performance — PosMarket

État des lieux mesuré le 2026-11-02 sur le commit `a1a365b`, puis plan de
traitement. Les chiffres ci-dessous viennent du code et de la sortie de
`next build`, pas d'une estimation à vue.

Périmètre validé : **espace vendeur (POS, inventaire, commandes) en priorité,
puis marketplace et boutique.** Les deux symptômes signalés — lenteur
d'affichage et clics mous — sont traités ensemble, car ils ont des causes
distinctes qu'il faut corriger séparément.

## 1. Diagnostic

### 1.1 Le vrai coût : ~20 requêtes serveur en série avant le premier pixel

Chemin de rendu de `/pos` (identique pour `/inventory`, `/orders`, `/dashboard`,
qui partagent le layout) :

| # | Étape | Requêtes |
|---|---|---|
| 1 | `proxy.ts` — rate-limit + rafraîchissement de session | 1 |
| 2 | `layout` — `getCurrentSession()` → `profiles` | 1 |
| 3 | `layout` — `resolveAccountAccess()` → `profiles`, `stores`, `store_staff` | 3 |
| 4 | `layout` — `createClient()` puis **re-lit** `profiles`, `stores`, `store_staff` | 3 |
| 5 | `layout` — boutiques des employés | 1 |
| 6 | `layout` — `getStoreCookie()` → owner + staff | 2 |
| 7 | `page` — `supabase.auth.getUser()` | 1 |
| 8 | `page` — `getEffectiveStoreId()` → owner + staff | 2 |
| 9 | `page` — `fetchStoreData()` → contrôle d'accès + 7 lectures | 8 |
| 10 | `page` — `getPermissionsForUser()` | 3 |

**Total : ~20 requêtes, toutes séquentielles.** Les étapes 2 à 6 sont dans le
layout, donc rejouées à *chaque navigation* entre vues.

Redondance mesurée dans un seul rendu :

| Table | Lectures distinctes |
|---|---|
| `profiles` | 5 |
| `stores` | 7 |
| `store_staff` | 5 |

Le layout interroge Supabase (étape 4) alors que l'étape 3 vient déjà de lire
les mêmes lignes via Drizzle. Les mêmes données sont payées deux fois.

### 1.2 Rien n'est affiché pendant l'attente

- `src/app/(app)/loading.tsx` existe, mais c'est un squelette **de tableau de
  bord** : il s'affiche aussi en naviguant vers `/pos`.
- Aucun `<Suspense>` dans l'espace vendeur : la page attend la dernière requête
  avant d'envoyer le premier octet de HTML.
- `force-dynamic` + `revalidate = 0` sur tout `(app)` : zéro cache, par choix
  assumé (données par boutique), donc la latence DB est intégralement exposée.

### 1.3 JavaScript trop lourd

- **409 Ko** dans un seul chunk, contenant uniquement `jsPDF` + `html2canvas`.
  Cause : `InvoicesView.tsx` et `ReportsView.tsx` les importent statiquement.
  Or `src/utils/receipt.ts` fait déjà correctement `await import('jspdf')` —
  le bon modèle existe déjà dans le projet.
- **Aucun** `next/dynamic` sur les vues. `StorefrontView` fait 5 044 lignes,
  `InventoryView` 1 901, `POSView` 1 355 : tout est dans le bundle de la route.
- `ProductImage` déclare `sizes="… 33vw"` pour toutes les tailles. En POS, la
  grille affiche 6 à 7 colonnes (~16vw) : le navigateur télécharge des images
  deux fois plus grandes que nécessaire.

### 1.4 Les clics mous

- 200 produits filtrés à **chaque frappe** dans `POSView` (`filteredProducts`).
  Un `useMemo` amortit, mais le re-rendu reste sur le chemin critique de la
  saisie ; aucun `useDeferredValue` ni debounce.
- **36 `router.refresh()`**. Chaque appel re-rend le layout complet — donc les
  ~20 requêtes ci-dessus — pour rafraîchir une seule ligne.
- `<div key={currentView}>` dans `MainLayout` : changer de vue démonte tout le
  sous-arbre. L'état local (recherche, filtres, brouillon de panier) est perdu,
  ce qui donne l'impression d'un rechargement.

## 2. Plan, par lots

Un lot = un commit = un déploiement vérifiable. Si une régression apparaît, on
sait d'où elle vient.

### Lot 1 — Supprimer les lectures redondantes *(gain le plus fort)*

| Action | Fichier |
|---|---|
| Le layout réutilise le résultat de `resolveAccountAccess` au lieu de refaire 3 requêtes Supabase | `src/app/(app)/layout.tsx` |
| Mémoïsation par requête (`React.cache`) du profil et des boutiques | `src/lib/request-cache.ts` *(nouveau)* |
| `getEffectiveStoreId` réutilise la boutique déjà validée | `src/utils/store-cookie.ts` |
| `getPermissionsForUser` réutilise le profil déjà lu | `src/utils/permissions.ts` |

**Cible : ~20 → ~8 requêtes par navigation.**

⚠️ **Risque à traiter explicitement** : `getEffectiveStoreId` et
`requireStoreAccess` font un **contrôle d'accès**. La mutualisation ne doit pas
court-circuiter cette vérification — on réutilise un résultat *déjà autorisé*,
jamais une valeur fournie par le client. Un test de non-régression dédié
(vendeur qui tente la boutique d'un autre) doit précéder la fusion.

### Lot 2 — Ne plus bloquer l'affichage *(le plus visible)*

- Squelettes spécifiques : `pos/loading.tsx`, `inventory/loading.tsx`,
  `orders/loading.tsx` (celui du dashboard reste).
- `<Suspense>` autour des blocs lourds, coquille envoyée immédiatement.
- Remplacer les `router.refresh()` les plus fréquents par une mise à jour ciblée
  (react-query est déjà installé et sous-utilisé : 7 `useQuery` seulement) ou
  `revalidateTag` sur les tags de boutique.

**Effet : le temps total baisse peu, le temps *perçu* s'effondre.**

### Lot 3 — Alléger le JavaScript *(bénéficie aux deux surfaces d'un coup)*

- `dynamic(() => import('@/views/InvoicesView'))` et idem `ReportsView`
  → **−409 Ko** pour toutes les routes qui ne les affichent pas.
- Découper `StorefrontView` (5 044 lignes) en sous-composants chargés à la
  demande.
- Corriger `sizes` de `ProductImage` selon le contexte (grille POS vs fiche
  produit) pour arrêter de sur-télécharger.

### Lot 4 — Rendre les interactions immédiates

- `useDeferredValue` sur la recherche POS (et inventaire).
- Transition de vue qui conserve l'état au lieu du `key` qui démonte tout.
- Vérifier l'optimistic UI sur l'ajout au panier.

### Lot 5 — Marketplace et boutique

- Poursuite du découpage du storefront, images, `loading.tsx` du storefront.
- Le storefront est public : il peut tirer parti d'un cache (`revalidate`) là où
  l'espace vendeur ne le peut pas.

## 3. Mesure

Trois indicateurs, relevés **avant** le lot 1 puis après chaque lot :

1. **Requêtes SQL par navigation** — compteur temporaire dans `src/db/index.ts`,
   journalisé en développement, retiré avant la fusion.
2. **Poids JS par route** — `next build` + tailles de `.next/static/chunks`.
3. **Temps perçu** — `router.push` chronométré côté client, ou Vercel Speed
   Insights si activé.

Sans ces trois chiffres, « plus fluide » n'est qu'une impression, et on ne saura
pas si un lot a réellement servi.

## 4. Ce qui n'est PAS dans ce plan

- Changer de base ou de fournisseur d'hébergement.
- Supprimer `force-dynamic` : la contrainte est réelle (données par boutique et
  par utilisateur), le problème n'est pas l'absence de cache mais le nombre
  d'allers-retours.
- Réécrire l'architecture en SPA : le `key={currentView}` et les vues
  monolithiques sont traités au lot 4, sans refonte.

## 5. Ordre de livraison proposé

```
Lot 1  →  mesure  →  Lot 2  →  mesure  →  Lot 3  →  Lot 4  →  Lot 5
```

Les lots 1 et 2 sont ceux qui répondent à « les pages mettent du temps » et
« les clics répondent mollement ». Le lot 3 est du gain gratuit sur les deux
surfaces et peut être fusionné en parallèle si tu préfères voir un résultat
rapide sur le poids de page.
