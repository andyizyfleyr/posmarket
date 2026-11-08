# Plan d'intégration — Vente de produits numériques sur PosMarket

> État du dépôt : branche `arena/f7d7eb22-posmarket` (visibilité `posmarket-eight.vercel.app`).
> Dernière migration : `drizzle/0035_feexpay_provider.sql` → cible **`drizzle/0036_digital_products.sql`**.
> Périmètre v1 : **fichiers numériques livrés par téléchargement après paiement confirmé**
> (PDF, EPUB, ZIP, audio, vidéo, images, tableurs…). Les licences/clés API, le
> streaming et les abonnements de contenus sont hors v1 (voir §12).

## 0. Principes directeurs (rien ne doit casser)

1. **Zéro impact par défaut.** Tout ajout est rétro-compatible : `products.product_type`
   vaut `'physical'` pour les lignes existantes ; aucune requête, aucune UI, aucun
   flux de paiement n'est modifié tant qu'un vendeur n'a pas coché « Produit numérique ».
2. **Un seul point de bascule paiement** : `markStorePaymentPaid` (`src/lib/store-payments.ts:804`),
   partagé par le flux « callback navigateur » et les 4 webhooks fournisseurs.
   C'est l'unique endroit où l'ordre passe à `PAID` → c'est là (et seulement là)
   que les droits de téléchargement sont créés. Idempotent.
3. **Pas de COD pour le numérique.** Une commande contenant au moins un produit
   numérique exige un paiement en ligne ; le numérique est livré par le lien,
   pas par un livreur.
4. **L'API reste la seule autorité.** Pas de génération de liens côté client.
   Tout passe par des jetons hachés (SHA-256) côté serveur, jamais exposés en clair.
5. **Parité web / app** : v1 complète sur le web (vendeur + acheteur + admin),
   app Expo v1 en lecture (badge + bouton « Télécharger » qui ouvre le lien
   signé, comme « Ouvrir dans le navigateur »). Pas de gestion de fichiers
   vendeurs depuis l'app en v1.

## 1. Modèle de données (migration `0036_digital_products.sql`)

```sql
BEGIN;

-- 1) Nature du produit : 'physical' (défaut, rétro-compatible) | 'digital'
ALTER TABLE "products"
  ADD COLUMN "product_type" text NOT NULL DEFAULT 'physical';
CREATE INDEX IF NOT EXISTS "products_product_type_idx" ON "products" ("product_type");

-- 2) Fichiers du produit (1 produit numérique peut porter plusieurs fichiers)
CREATE TABLE IF NOT EXISTS "digital_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,            -- nom d'affichage (analyse sécurité : échappé)
  "storage_key" text NOT NULL,          -- clé privée bucket (jamais exposée)
  "mime" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "sha256" text NOT NULL,               -- empreinte du fichier (intégrité + anti-doublon)
  "uploaded_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid                     -- profil vendeur
);
CREATE INDEX IF NOT EXISTS "digital_assets_product_id_idx" ON "digital_assets" ("product_id");

-- 3) Droits de téléchargement (un par ligne de commande numérique, par produit)
CREATE TABLE IF NOT EXISTS "download_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "asset_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "token_hash" text NOT NULL,           -- SHA-256 du jeton (en clair jamais stocké)
  "buyer_user_id" uuid,                 -- acheteur connecté (nullable, invité)
  "buyer_email" text,                   -- toujours rempli au checkout numérique
  "max_uses" integer NOT NULL DEFAULT 5,
  "used_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz NOT NULL,    -- défaut : 30 jours
  "revoked_at" timestamptz,             -- remboursement / annulation admin
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "download_grants_token_hash_uniq" UNIQUE ("token_hash")
);
CREATE INDEX IF NOT EXISTS "download_grants_order_idx" ON "download_grants" ("order_id");
CREATE INDEX IF NOT EXISTS "download_grants_buyer_idx" ON "download_grants" ("buyer_user_id");

-- 4) Journal d'audit (RGPD-friendly : IP tronquée)
CREATE TABLE IF NOT EXISTS "download_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "grant_id" uuid REFERENCES "download_grants"("id") ON DELETE SET NULL,
  "order_id" uuid,
  "product_id" uuid,
  "ip_hash" text,
  "user_agent" text,
  "bytes" bigint,
  "result" text NOT NULL,               -- ok | expired | revoked | limit | invalid
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "download_events_grant_idx" ON "download_events" ("grant_id");

-- 5) Garde-fous métier (données existantes intactes : product_type = 'physical')
;
COMMIT;
```

Notes :
- Aucun backfill — `DEFAULT 'physical'` couvre les lignes existantes.
- `orders` / `order_items` / `invoices` inchangés dans leur structure.
- Pas de stock requis en numérique : `products.stock` ignoré pour ces lignes (voir §4).
- Même commission de plateforme que le physique (paiements vendeurs = `store_payments`, inchangé).

## 2. Stockage des fichiers (décision clé — SUPABASE N'EST PLUS UTILISÉ)

> Constat : PosMarket n'utilise **plus de Supabase**. Les modules `src/utils/supabase/*`
> et `src/supabase.ts` / `src/supabase-api.ts` sont des **shims** (compatibilité de
> noms) branchés sur `getCurrentSession`, Drizzle et `DATABASE_URL` — Postgres seul.
> Les paquets `@supabase/supabase-js` et `@supabase/ssr` ne sont importés nulle part ;
> dépendances mortes (à retirer lors d'un nettoyage dédié). Le plan **abandonne
> Supabase Storage**. Trois options viables — décision requise avant P0 :

- **Option A — Vercel Blob (`@vercel/blob`)** *(recommandé si on reste sur Vercel)*
  - `put(key, file, { access: 'private' })` + lecture via le SDK côté serveur →
    aucune URL publique persistante ; URL signée courte (≤ 5 min) émise par la route
    `/api/download/[token]`.
  - Upload **direct navigateur → Blob** (`upload()` client SDK + jeton serveur,
    `@vercel/blob/client`) : indispensable, la limite de corps des routes Next/Vercel
    interdit de faire transiter les fichiers par l'API (≈ 4,5 Mo).
  - Zéro infra, facturation à l'usage, intégration native Vercel.
- **Option B — Stockage objet S3-compatible** (Cloudflare R2, OVH Object Storage,
  AWS S3, MinIO auto-hébergé)
  - URL présignées `GetObject` 120 s (lecture) et `PutObject` présignée (upload, hors
    API route) ; meilleur coût par To et portabilité ; demande des clés en env `S3_*`
    et un bucket privé créé une fois.
- **Option C — Postgres `bytea`** ❌ écartée (documents < 2 Mo seulement, bande passante
  serveur, pas de streaming, risque mémoire).

Recommandation v1 : **Option A** si PosMarket reste sur Vercel ; **Option B** si un
bucket S3/R2 existe déjà. L'interface `src/lib/digital-storage.ts` abstrait les deux
(`saveAsset`, `createReadUrl`, `removeAsset`, `statUsage`) : aucun autre changement
dans le plan selon le choix.

- Clé : `{storeId}/{productId}/{uuid}-{nom-sanitisé}` ; `Cache-Control: private, no-store`.
- Quota par boutique (configurables, extensibles sans migration) :
  - `DIGITAL_MAX_FILE_MB` = 200 Mo ; Starter 2 Go / Pro 20 Go / Entreprise illimité ;
  - quota affiché dans l'écran vendeur.
- Upload : **jamais** de fuite partielle — upload annulé si checksum client ≠ serveur
  (SHA-256), `digital_assets` écrit uniquement après succès complet.
- **Interdit** : base64 dans `products.image` (pattern actuel images, OK pour 300 Ko,
  inacceptable pour un ebook), data URI en `digital_assets`.
- **Limites** (vérifiables dans le plan d'abonnement PosMarket) :
  - `DIGITAL_MAX_FILE_MB` = 200 Mo (plafond par fichier, configurable par palier) ;
  - quota total par boutique : Starter 2 Go / Pro 20 Go / Entreprise illimité
    (extensible sans migration, valeurs dans `SUBSCRIPTION_PLANS`) ;
  - quota affiché dans l'écran vendeur ("Espace fichiers : 1,2 Go / 20 Go").
- **Repli accepté** : Vercel Blob (`@vercel/blob`, `put` avec `access: 'private'`),
  même interface côté code (`src/lib/digital-storage.ts`) : `saveAsset()`,
  `createReadUrl(key, ttl)`, jamais d'exposition publique.
- **Interdit** : base64 dans `products.image` (pattern actuel images, OK pour 300 Ko,
  inacceptable pour un ebook de 80 Mo), data URI en `digital_assets`.

### 2.1 Surface d'API stockage (`src/lib/digital-storage.ts`)

```ts
export async function putDigitalAsset(input): Promise<{ key: string; size: number; sha256: string }>
export async function createSignedDownloadUrl(key: string, ttlSeconds = 120): Promise<string>
export async function removeDigitalAsset(key: string): Promise<void>
export async function statStoreBucketUsage(storeId: string): Promise<number>
```

## 3. Parcours vendeur — créer un produit numérique

Cible : `InventoryView.tsx` (web, `src/views/InventoryView.tsx` + variantes),
page `(app)` côté vendeur. **Aucune régression sur le formulaire actuel.**

Champs ajoutés (UI) :
- Interrupteur **« Produit numérique — livré par téléchargement »** en haut du
  formulaire (`product_type`).
- Si activé :
  - masquage des champs physiques (stock, délai, préparation, wholesale reste autorisé
    y compris pour le numérique : prix dégressifs OK, livraison non) ;
  - zone d'upload (1..N fichiers), validation **extension + magic bytes** (ZIP/PDF/ePub/
    MP3/MP4/PNG/MD…), `Content-Length ≤ DIGITAL_MAX_FILE_MB`, checksum SHA-256 calculé
    côté client (affiché) et vérifié côté serveur ;
  - options : expiration (défaut 30 j / 7 / 90 / sans) et nombre max de téléchargements
    (défaut 5 / 1 / 10 / ∞) ;
  - cases à cocher obligatoires : « Je détiens les droits de redistribution » ;
  - bandeau : "Les produits numériques sont payables uniquement en ligne".
- Validation serveur (obligatoire, pas seulement UI) :
  - publication impossible si `product_type='digital'` et `digital_assets` vide
    → `isOnline=false`, erreur explicite ;
  - refuse les extensions dangereuses (.exe, .bat, .sh, .app, .dmg, .msi, .com, .scr, .jar)
    en v1 (politique anti-malware ; réévaluée en v1.1 avec scan) ;
  - montant, nom, etc. réutilisant les validations existantes.

Effets de bord maîtrisés :
- l'onglet « Restauration » et les catégories restent inchangés ; le numérique vit
  dans l'univers « Shopping » (facultativement tout le businessType reste `shopping`,
  orthogonal — **ne pas** mélanger à `business_type=food`).
- Le catalogue en ligne (SSR `[[...slug]]`), la recherche FTS, `MAIN_CATEGORIES`,
  le boost, les coupons, les avis, les frais : **inchangés** — un produit numérique
  est un produit normal + `productType`.

App Expo (v1) : écran fiche produit → badge « Téléchargement instantané » et bouton
« Télécharger » visible si l'utilisateur a acheté (ouvre le lien signé système).
Aucune UI vendeur app v1 (le créateur utilise le web).

## 4. Commande & paiement — les seules modifications profondes

### 4.1 Blocage anti-COD (checkout)

Fichier : `src/app/actions/checkout.ts` (logique `storeCheckouts`) +
`src/views/storefront/CartCheckoutView.tsx` (choix du mode de paiement côté UI).

Règle : un storeCheckout dont le panier contient ≥ 1 ligne numérique →
`paymentMethod` forcé à prépayé, COD retiré du sélecteur de cette boutique,
avec message : « Les produits numériques sont payés en ligne, livraison par lien ».
Un panier **mixte** (physique + numérique) : toute la commande passe en prépayé.

Backend (défense en profondeur) : avant insertion des `orders`, si un line digital →
`reject('Paiement en ligne requis pour les produits numériques.')` lorsque COD.
Aucun impact sur un panier 100 % physique : à comportement strictement identique.

### 4.2 Pas de décrément de stock en numérique

Dans la section de vérification conditionnelle (`simpleOps`/`variantOps`, zone SQL
`SELECT 1/CASE WHEN EXISTS ... stock = expected - quantity`, lignes ~1000-1130) :
- `simpleOps` : ajouter `AND p.product_type = 'physical'` à la garde, et
  **sauter** la garde stock pour les lignes numériques (elles n'ont pas de stock) ;
- le `UPDATE ... stock = stock - quantity` équivalent (fin du bloc batch, à localiser
  dans `db.batch` — inclure la condition `product_type='physical'` dans le `WHERE`) ;
- `productStats` (unités vendues) : **inchangé** (ventes comptent) ;
- les algorithmes d'accueil/sections (`isMarketableProduct`, `diversifyProducts`) :
  aucune modification — le numérique est marketable normalement.

### 4.3 Création des droits de téléchargement à la bascule PAID

Dans `src/lib/store-payments.ts`, **à la fin de `markStorePaymentPaid`** (point unique) :

```ts
await createDigitalGrantsForOrder(row.orderId).catch((e) =>
  // Ne jamais faire échouer l'encaissement pour un souci de livraison :
  // un cron de rattrapage régénère les droits manquants.
  console.error('[digital] création des grants', e)
);
```

`createDigitalGrantsForOrder` (nouveau `src/lib/digital-delivery.ts`) :
1. lit l'order + ses `order_items`, joint `products` `product_type` & `digital_assets` ;
2. si aucune ligne numérique → return immédiatement (chemin physique, zéro overhead SQL) ;
3. pour chaque ligne numérique : `INSERT ... ON CONFLICT DO NOTHING` un grant par
   (order_item_id, produit) — jeton `crypto.randomBytes(32)`, stocké en SHA-256 ;
4. envoie l'email « Votre achat numérique » avec **un lien par grant**
   (voir §6) — idempotent : ne pas renvoyer si grants déjà existants ;
5. invalide les tags pertinents.

Conséquences :
- **Seul le passage à PAID génère des droits.** COD jamais. Refus/échec = aucun grant.
- Les 4 webhooks (kkiapay/fedapay/feexpay/saspay) **et** le flux client-verify
  passent par `markStorePaymentPaid` → **aucune modification de webhook requise**.
- Le COD ne peut pas livrer de numérique (§4.1) → pas de chemin « payé à la livraison"
  pour le numérique. Si demain un vendeur force manuellement un produit numérique en
  COD, aucun grant n'est créé : à documenter côté admin.
- Cron de rattrapage (v1, optionnel) : `reconcilePendingStorePaymentsForProvider`
  (existant) couvre déjà le PAID automatique via tous les fournisseurs.

### 4.4 Annulation / remboursement

Ajouter (à la même famille que `markStorePaymentFailed`) :
`revokeDigitalGrantsForOrder(orderId, reason)` → `revoked_at = now()`. À appeler :
- dans l'action admin/vendeur de passage à `REFUNDED` / annulation (grep
  `updateOrderStatusAction` / panneau `/pam/inventory` | `/pam/orders`) ;
- jamais automatique depuis les webhooks (les fournisseurs ne signalent pas les
  rétrofacturations simplement en v1 — suivi manuel, loggé dans `download_events`).

## 5. Livraison — le lien de téléchargement

### 5.1 Route publique `GET /api/download/[grantToken]`

Fichier : `src/app/api/download/[grantToken]/route.ts` (nouveau).

1. Rate limit IP (lib `src/lib/rate-limit.ts` existante, ex. 30/min — réutiliser `rateLimit`).
2. `tokenHash = sha256(token)` lookup grant (+ join order payment_status, items, assets).
3. Refus 404/410 si : token inconnu, `revoked_at` non null, `expires_at < now()`,
   order `payment_status != 'PAID'` (ex. remboursé) — chaque refus loggé (`download_events`).
4. Si `used_count >= max_uses` → 410 « Nombre de téléchargements atteint ».
5. Sinon : `UPDATE ... SET used_count = used_count + 1 WHERE id=$1 AND used_count < max_uses RETURNING used_count`
   (incrément atomique, pas de course), puis `createSignedDownloadUrl(assetKey, 120)` →
   **302 vers l'URL signée** (Vercel Blob ou S3/R2 selon option retenue) avec `Cache-Control: no-store`.
6. Fichiers multiples : page intermédiaire minimale (ou liste) avec un lien signé par
   fichier (chaque clic 302 → signée dédiée). Chaque asset consomme 1 « use » par
   téléchargement ? v1 : `used_count` par grant, pas par fichier, affiché à l'utilisateur.
7. Aucune donnée vendeur non pertinente exposée ; la réponse d'erreur est unique et
   sobre (pas d'énumération d'existants).

**Pas de watermark PDF en v1** — noté en v2 (librairie `pdf-lib`) avec identifiant acheteur ;
zip chiffré hors scope.

### 5.2 Email de livraison

- `src/lib/email.ts` : nouveau gabarit transactionnel reuse SMTP (`sendEmail`) —
  sujet « Votre achat numérique — {produit} », corps sobre (lien unique par grant,
  validité, contact vendeur). On peut réutiliser le socle visuel `order_confirmation`.
- Marquage dans `download_events` (`result='ok'` à la création ? non : mail_sent pour
  tracer), et les liens restent valables **après** l'email (pas d'usage unique à l'email).
- Invités : email obligatoire au checkout numérique → adresse stockée dans `buyer_email`
  (existant sur `orders`) + dans chaque grant.
- Acheteurs connectés : en plus, onglet **« Mes produits »** dans `/mon-compte/apercu`
  (Next : `src/components/buyer/` nouveau `DigitalProductsTab.tsx` ; Expo : même onglet
  dans `app/(account)` — à localiser dans l'app Expo) :
  - liste des achats numériques (productName, date, bouton « Télécharger à nouveau ») ;
  - côté API : `fetchBuyerDigitalProductsAction()` → grants where `buyer_user_id = session.user.id`
    AND revoked_at IS NULL ; le bouton régénère une URL signée (nouveau endpoint
    `POST /api/download/grant/:id/url` auth-required, 120 s) — jamais le token brut.

### 5.3 Succès de commande (web)

`src/views/storefront/CartCheckoutView.tsx` (success screen) : si la réponse poste
`digitalLines > 0` → bloc dédié : jusqu'à N liens « Télécharger » (liens grants
éphémères créés au même moment) + mention « Un lien valable 30 jours et jusqu'à 5
téléchargements vous a été envoyé par email ». Si invité : même message, liens visibles
uniquement jusqu'à fermeture de l'onglet (pas de persistance publique).

## 6. Administration /pam

Extensions minimales (pas de page dédiée en v1 pour rester léger) :
- `/pam/inventory` : filtre « Type : Tous / Physiques / Numériques » ; colonne badge
  `Téléchargement` pour les digitaux ; colonne « Fichiers » (nombre).
- `/pam` (surveillance) : 2 KPI — « Produits numériques » (count Online) et
  « Téléchargements 30j » (`download_events`).
- `/pam/orders` : affichage des items avec badge `numérique` (read-only).
- **Pas de page admin de download** (matériau sensible) : tout passe par les grants existants.
- Révocation manuelle : bouton « Révoquer l'accès » sur la fiche commande (appelle
  `revokeDigitalGrantsForOrder`) — visible seulement si ≥ 1 grant non revoked.

## 7. Sécurité — résumé des garde-fous

| Risque | Parade |
|---|---|
| Lien public permanent | signée 120 s émise à la demande, jetons hachés (SHA-256) jamais stockés en clair |
| Partage de lien (repost) | `used_count` plafonné (défaut 5) + `expires_at` (défaut 30 j), révocable admin/vendeur |
| Vol d'achat avant paiement | création des grants **uniquement** en `markStorePaymentPaid` |
| COD pour produit numérique | interdit UI + refus serveur ; aucun grant créé |
| Injection MIME / fichier malveillant | validation extension **et** magic bytes, blocage exécutables, taille plafonnée |
| SSRF via « URL du fichier » | pas d'URL : upload direct navigateur→serveur→bucket privé uniquement |
| énumération / oracle | route `/api/download/[token]` : même réponse d'erreur, rate limit IP, journal |
| Stock épuisé en numérique | stock non décrémenté, achat toujours possible (satisfasant la disponibilité) |

Limite honnête : un PDF volé reste volable — v2 : watermark nominatif + manifeste
d'intégrité. À énoncer clairement aux vendeurs dans l'UI d'upload.

## 8. Compatibilité catalogues, recherche, accueil

- `fetchMarketplaceData` / `fetchHomeMarketplaceData` : ajouts seulement, rien retiré ;
  le type est projeté (`productType: string`) — le storefront l'ignore aujourd'hui ; on
  ajoute un badge discret sur la carte produit **après validation P1**, pas avant.
- Recherche FTS (`searchVector`) : inchangée ; un produit numérique est trouvable par
  son nom/catégorie comme les autres.
- Sections accueil vendeur (`buildHomeSections`) : inchangées (le numérique est
  éligible aux 6 catégories/éditeur — décision business OK pour v1).
- Homepage config (`/pam/accueil`) : inchangée ; le numérique obéit aux mêmes règles.

## 9. Impact Expo (app mobile)

- `StorefrontProduct` (types `src/types.ts`) : `productType?: 'physical' | 'digital'`.
- Fiche produit (`posmarket-mobile/app/product/[slug].tsx`) : badge + suppression
  des CTA de livraison physique, afficher « Téléchargement instantané après paiement ».
- Checkout (`posmarket-mobile/app/checkout.tsx`) : masquer COD si ≥ 1 digital (comme web).
- Succès + onglet commandes (`AccountView` / OrderCard) : bouton « Télécharger » qui
  `Linking.openURL(grantUrl)` — aucune copie de fichier en mémoire.
- Token grant : **jamais** transporté en clair hors `https` — toujours même domaine API.

## 10. Lots, séquencement et estimation

| Phase | Contenu | Estimé | Gate de sortie |
|---|---|---|---|
| P0 — Fondations | migration 0036 + `src/lib/digital-*.ts` + storage client + tests unitaires (grants, expiry, hash) | 1,5 j | `npm test` vert, migration sur staging |
| P1 — Vendeur | toggle + upload + validations + badge inventaire | 2 j | créer/éditer/publier un produit numérique en staging |
| P2 — Checkout & paiements | blocage COD mixte/digital, garde stock, grants à PAID + email | 2 j | test e2e : gratuit→refus, COD→refus, FedaPay sandbox→lien reçu |
| P3 — Livraison & compte | route `/api/download/[token]`, « Mes produits » + onglet acheteur, Mon compte | 2 j | aucun téléchargement possible sans PAID/grant ; audit log OK |
| P4 — Admin | filtres inventory, KPI dashboard, révocation | 0,5 j | révocation coupe le lien (test 302→410) |
| P5 — Expo | badge + bouton + checkout COD masqué | 1 j | parité d'affichage, pas de régression scan |
| P6 — QA & rollout | recette, gate, staging, production derrière flag `DIGITAL_PRODUCTS=on` | 1 j | voir §11 |

Total : **~10 jours-homme**. MVP livrable (P0+P1+P2+P3) : **~7,5 j**.

## 11. Déploiement incrémental & rollback

1. Migration 0036 exécutée **d'abord** en staging après sauvegarde (`pg_dump` vérifié) ;
   aucun code ne s'appuie dessus avant le merge P0.
2. Feature flag `digital_products` (pattern déjà utilisé pour le maintenance mode /
   `system_settings` ou variable d'env serveur `DIGITAL_PRODUCTS=true`) : masque le
   bouton "Produit numérique" en création. Off par défaut.
3. Première boutique pilote (l'admin /pam les désignera) — conformité stockage affichée.
4. **Rollback** : `digital_products=false` re-masque création/affichage ; les grants
   déjà émis restent valables (expiration/plafonds s'appliquent) ; aucune donnée n'est
   supprimée. Revert SQL complet possible tant qu'aucune vente digitale n'a été faite,
   sinon marquer `product_type='physical'` et fermer les grants (`revoked_at = now()`).
5. Aucun secret côté client : seul un jeton serveur **à usage unique** autorise l'upload
   direct (Vercel Blob `handleUpload` ou présigné S3) ; la lecture passe toujours par
   l'URL signée courte côté serveur. Aucun chemin de fichier n'est devinable sans jeton.

## 12. Hors scope explicite v1 (à valider séparément)

- Licences/clés applicatives, DRM, watermark nominatif, PDF chiffré.
- Abonnements de contenu digital / streaming vidéo (nécessite lecteur + DRM Clapper).
- Paiement en plusieurs fois, escrow Tun, marketplace payouts différenciés.
- Gestion des droits par territoire (géo-blocage pour les assets).
- Analytics avancés (heatmap téléchargements par pays).

## 13. KPIs de réussite

- 100 % des lignes de commande numériques vendues en PAID → 1 grant créé (audit quotidien
  via `SELECT count(*) ... NOT EXISTS`, cron dédié).
- 0 grant pour une commande non-PAID (test automatique + alerte).
- 0 commande numérique en COD en production.
- Taux de téléchargement ≤ max_uses, taux d'échecs "link expired" < 5 %.
- Adoption vendeur : ≥ 10 boutiques publient ≥ 1 produit numérique sous 30 jours.

## 14. Risques majeurs restants (à trancher avant P0)

1. **Stockage** : confirmer l'option (A Vercel Blob — recommandé, zéro infra ; ou
   B bucket S3/R2/OVH/MinIO) et fournir les clés d'environnement. Décision bloquant P0.
2. **Livraison aux invités** : email obligatoire → UX checkout légèrement plus strict.
3. **Mixte physique+numérique** : v1 = 100 % prépayé pour la commande entière
   (le numérique "tire" la commande vers l'en ligne, même option que les autres
   prépayés existants). Alternative (deux sous-commandes) écartée.
4. **Contenus sensibles/illégaux** (ebooks piratés) : engage la responsabilité civile de
   la plateforme → décision DPO/mentions vendeur ; signalement litige → révocation grants.
5. **Performance API `/api/download/[token]`** : chaque clic = 1 SELECT + 1 UPDATE +
   1 création d'URL signée — trivial à ce trafic ; index `token_hash` UNIQUE fourni.

## 15. Checklist DONE (recette finale)

- [ ] npx tsc + eslint + build + tests ; migration 0036 jouée sur staging.
- [ ] Staging : vendeur crée un produit numérique, publie, achète en FedaPay/Kkiapay sandbox.
- [ ] Email reçu, lien 1×→302, 6e tentative→410, après 30 j→410, révoqué par admin→410.
- [ ] Commande mixte → COD refusé (UI + serveur). Commande physique → COD OK, aucun grant.
- [ ] Stock produit physique inchangé par vente numérique. Stats/ventes OK.
- [ ] App Expo : badge + ouverture lien. Web : badge + page succès liens.
- [ ] /pam : filtre, KPI, révocation fonctionnelle. Rollback flag testé en staging.
