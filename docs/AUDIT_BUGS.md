# Audit technique — bugs et risques détectés

Date : 2026-11-02 · Périmètre : `src/` (web Next.js 16), `posmarket-mobile/`, `drizzle/`, config.
Méthode : `tsc --noEmit`, `eslint`, lecture ciblée des flux sensibles (paiement, auth, checkout, push), vérification des migrations et des variables d'environnement.

## Synthèse

| Sévérité | Nombre | Nature |
|---|---|---|
| 🔴 Critique | 5 | Sécurité multi-tenant / données personnelles / fuite de secret |
| 🟠 Majeur | 5 | Bugs fonctionnels vérifiables |
| 🟡 Moyen | 6 | Robustesse, cohérence des données, DX |
| 🔵 Mineur | 6 | Qualité de code, lint, dette |

Le typage TypeScript passe (`tsc --noEmit` : 0 erreur). ESLint remonte **8 erreurs** (toutes dans `posmarket-mobile` ou sur des `any`) et 60 avertissements. Le build de production n'a pas pu être vérifié en sandbox (accès réseau à Google Fonts bloqué) mais aucun problème de compilation n'a été détecté.

---

## 🔴 Critiques

### 1. `POST /api/set-store` : écriture de cookie sans authentification
`src/app/api/set-store/route.ts` ne vérifie aucune session : n'importe qui peut positionner `currentStoreId`. Le cookie est certes vérifié à la lecture par `getEffectiveStoreId`, mais l'endpoint reste une écriture non authentifiée et un vecteur de confusion d'état (cache, logs, requêtes parallèles).
**Correctif** : exiger `getAuthUserId()` + `requireStoreAccess(storeId)` avant `setStoreCookie`.

### 2. `POST /api/marketplace/guest/push-token` : énumération + pollution inter-commandes
- Aucune limitation de débit.
- Aucun contrôle de cohérence : si `email` et `phone` sont fournis **et** que la commande n'a pas d'email/phone enregistré, les conditions `if (email && orderEmail && …)` passent silencieusement.
- **Fuite de données personnelles** : la réponse distingue `404 Commande introuvable`, `400 Commande liée à un compte`, `400 Email ne correspond pas`, ce qui permet d'énumérer des UUID de commandes et de tester des emails.
- `registerGuestPushToken` fait un `onConflictDoUpdate` sur `token` en **réécrivant `orderId`** : un jeton d'invité déjà enregistré sur la commande A peut être réattaché à la commande B (et inversement) sans preuve de possession.
**Correctif** : rate-limit partagé, exiger que email **et** phone correspondent tous deux quand ils sont fournis, message d'erreur unique, refuser le réattachement d'un jeton à une autre commande.

### 3. `guest_push_tokens.phone` n'existe pas dans le schéma Drizzle
`src/app/api/marketplace/guest/push-token/route.ts` lit `(orders as any).buyerPhone` — colonne **absente** de `src/db/schema.ts` (seuls `buyerUserId`, `buyerEmail` existent) et d'aucune migration. Les lignes 37→45 sont forcées en `any` précisément parce que le typage échouait.
**Conséquence** : `order.buyerPhone` est toujours `undefined` → la vérification par téléphone est **morte** (tout numéro est accepté pour une commande connue), et `guest_push_tokens.phone` reçoit `null` ou la valeur fournie par le client sans contrôle.
**Correctif** : soit ajouter `orders.buyer_phone` (migration + schéma + écriture au checkout), soit supprimer la branche téléphone et vérifier uniquement par email. Retirer les `as any`.

### 4. Secret PAM dérivé de `DATABASE_URL`
`src/app/actions/admin-auth.ts:21` : en l'absence de `ADMIN_AUTH_SECRET`, la signature des cookies d'administration est `HMAC('pam-admin', DATABASE_URL)`. La connexion base contient le mot de passe de production : toute fuite de `DATABASE_URL` (log, sauvegarde, variable d'un service tiers) permet de **forger un cookie admin** valide.
Aggravant : `part[1]` (expiration) est inclus dans le payload signé mais **jamais comparé à l'heure courante** → un cookie volé reste valide indéfiniment, alors que `maxAge` est de 8 h côté navigateur.
**Correctif** : refuser le démarrage sans `ADMIN_AUTH_SECRET` (>= 32 caractères), et rejeter le cookie si `Date.now() - issuedAt > SESSION_MAX_AGE * 1000`.

### 5. `/api/ping` expose le message d'erreur de la base
`src/app/api/ping/route.ts` renvoie `(e as Error).message` en clair. Une erreur Neon contient souvent l'hôte, l'utilisateur, la base, parfois le mot de passe dans la chaîne de connexion. L'endpoint est public, sans authentification, et appelé toutes les 3 minutes par GitHub Actions.
**Correctif** : `{ ok: false }` générique, journalisation côté serveur uniquement.

---

## 🟠 Majeurs

### 6. Réponse de checkout sans `customer` → push invité jamais enregistré
`submitCheckoutAction` renvoie `{ orderId, orderIds, orders }` mais **pas `customer`**. Or `posmarket-mobile/app/checkout.tsx:399` lit `(response as any).customer` puis transmet `email`/`phone` à `registerGuestPushToken`. Les deux valent donc toujours `undefined`.
Combiné au point 3, l'invité n'obtient **aucun suivi de commande** par notification, alors que c'est la raison d'être de `guest_push_tokens`.
**Correctif** : ajouter `customer: { email, phone }` (données fournies par l'appelant, déjà validées) au retour de l'action, et typer la réponse côté mobile (supprimer le `as any`).

### 7. Migrations appliquées manuellement : `npm run db:migrate` est inutilisable
`drizzle/meta/_journal.json` ne contient que 22 entrées, et **7 fichiers SQL n'y figurent pas** :

```
0019_boost_flags  0020_review_authors  0021_boost_v2
0022_boost_logs_voided  0023_api_rate_limits
0024_push_tokens  0025_guest_push_tokens
```

Pire, la migration **0025 est en double** (`0025_guest_push_tokens.sql` et `0025_saspay_subscriptions.sql`) et un seul des deux apparaît dans le journal. Le schéma réel de la base ne peut donc pas être reconstruit depuis `npm run db:migrate` : il faut jouer chaque fichier avec `scripts/apply-migration.mjs`.
**Risque** : `api_rate_limits` et `push_tokens`/`guest_push_tokens` absents en cas de nouvelle installation → limitation de débit distribuée inopérante et push silencieusement en échec.
**Correctif** : régénérer le journal (renuméroter 0026+ pour les fichiers non suivis), ajouter un test CI qui compare `pgTable` du schéma aux tables créées par l'ensemble des migrations, et interdire deux fichiers portant le même préfixe.

### 8. `saveCustomerAction` permet de modifier le client d'une autre boutique
La garde `requireStoreAccess(storeId)` vérifie la boutique **passée en paramètre**, puis l'action fait `UPDATE customers … WHERE id = customer.id` **sans contraindre `storeId`**. Un vendeur authentifié sur sa propre boutique peut donc éditer (nom, téléphone, email, `totalSpent`) un client appartenant à une boutique concurrente en connaissant son UUID.
**Correctif** : `.where(and(eq(customers.id, id), eq(customers.storeId, storeId)))`, ou réutiliser `requireCustomerStoreAccess(customer.id)` comme le font déjà `deleteCustomerAction` / `bulkDeleteCustomersAction`.

### 9. Filtre anti-bots du proxy : `curl` et `wget` bloqués, webhooks non
`src/proxy.ts` bloque `curl/`, `wget`, `python-requests`, `okhttp`… L'exception `isSaspayWebhook` est ciblée sur le seul webhook SasPay. Les webhooks **FedaPay, FeexPay, Kkiapay et WhatsApp** ne sont pas exemptés : s'ils sont émis par un client HTTP dont l'User-Agent correspond au motif (ou sans UA), ils reçoivent `403 Forbidden` **avant** d'atteindre la vérification de signature — donc sans trace applicative.
**Correctif** : exempter explicitement `/api/(fedapay|feexpay|kkiapay|whatsapp|saspay)/webhook` (la sécurité repose sur la signature HMAC, pas sur l'UA), ou au minimum journaliser les 403 sur ces chemins.

### 10. `backend/package.json` : aucun test unitaire ni intégration hors SasPay
`test:saspay` couvre 12 cas (dont un vrai passage sur PostgreSQL). En revanche **aucun test** ne couvre le checkout, les autorisations multi-boutiques, le cron/l'authentification cron, ni les actions clients. Ce sont précisément les zones où les points 1–8 se trouvent.
**Correctif** : ajouter au minimum des tests d'autorisation (un utilisateur A ne peut pas écrire sur la boutique B) sur `customers`, `inventory`, `invoices`, `orders`.

---

## 🟡 Moyens

### 11. `customers` : recherche serveur sans anti-rebond fiable et effet concurrent
`src/views/CustomersView.tsx:64` lance `getCustomersAction` après 500 ms **sans `AbortController` ni numéro de séquence**. Deux frappes rapprochées peuvent faire arriver la réponse de la requête 1 après celle de la requête 2 : la liste affichée ne correspond plus au champ de recherche. Le `useMemo` de tri dépend en plus de `searchTerm` sans l'utiliser (lint).

### 12. `InvoicesView` / `OrdersView` : dépendance d'effet incomplète
`useEffect(..., [selectedInvoice?.id])` (InvoicesView:74) et `[selectedOrder?.id]` (OrdersView:132) : si l'entité est mise à jour avec le **même id** (ligne 816 `setSelectedInvoice(updated)`), l'effet ne se relance pas et les lignes détaillées restent périmées (`selectedInvoiceItems`). Utiliser un compteur `version` ou dépendre de l'objet complet.

### 13. `updateSystemSettings` : changement de fournisseur non atomique
Les paramètres sont écrits un par un dans une boucle `for`, avec `payment_provider` trié en dernier. Si la requête échoue au milieu, la clé SasPay peut être enregistrée sans que le fournisseur soit activé (acceptable), mais l'inverse est possible en cas d'échec réseau après l'écriture du fournisseur et **avant** `revalidatePath` : les pages gardent l'ancien rendu jusqu'à expiration. Envelopper dans `db.transaction(...)` et invalider les tags (`refreshTag('marketplace')`) en plus de `revalidatePath`.

### 14. `orders.ts` : dépendance implicite `referenceItemPrice`
Avertissement ESLint `exhaustive-deps` sur un `useCallback` de calcul de prix (`OrdersView` / `orders.ts` côté mobile). Un prix de référence modifié côté serveur ne recalcule pas la ligne : total affiché ≠ total facturé dans certains flux de commande manuelle.

### 15. Lazy loading absent sur 24 balises `<img>`
`grep "<img"` : 24 occurrences (StorefrontView, Navbar, ReportsView, ProductDetailsView…), aucune avec `loading="lazy"`, et 3 sans `alt` (a11y). Les fiches produits chargent toutes les vignettes d'un coup.

### 16. `next/font` Google : build dépendant du réseau
`src/app/layout.tsx` importe `Inter` depuis `fonts.googleapis.com`. Sans réseau sortant au build (CI isolée, Vercel en incident), `next build` échoue. C'est précisément ce qui s'est produit en sandbox. Auto-héberger la police via `next/font/local` supprime la dépendance.

---

## 🔵 Mineurs

| # | Point | Détail |
|---|---|---|
| 17 | `no-explicit-any` (8 erreurs ESLint) | `guest/push-token/route.ts` (5), `orders.ts:112` (`buildPushContent(event as any)` — `NotificationEvent` est déjà typé), `posmarket-mobile/app/checkout.tsx:399` |
| 18 | `set-state-in-effect` | `posmarket-mobile/src/components/seller/SellerGates.tsx:97` : `setActiveStep` + `setFormData` synchrones dans un effet → double rendu à chaque changement de `store` |
| 19 | Variable exportée inutilisée | `export const runtime = 'nodejs'` absent mais `posmarket-mobile` mentionnée à tort dans `tsconfig.include` (projet exclu) : aucun contrôle de types sur l'app mobile en CI |
| 20 | Code mort | `StorefrontView.tsx` : `FtsRow` (93), `onBackToApp` (292), `expandedSections`/`setExpandedSections` (1801) ; `CartCheckoutView` : `formatPhoneSN`, `isValidPhoneSN`, `setIsApplyingPromo` ; `orders.ts` : `ACCES_REFUSE` importé sans usage |
| 21 | Cohérence de nommage | `orders.buyerEmail` existe mais pas `buyerPhone` ; `guest_push_tokens.phone` existe — asymétrie à l'origine du bug n°3 |
| 22 | Doublon de migration | Deux fichiers `0025_*` : tout outil qui trie par préfixe peut en appliquer un et ignorer l'autre |

---

## Ordre de correction recommandé

1. **n°3 + n°6** (une seule PR) : ajouter `orders.buyer_phone` *ou* retirer la branche téléphone, puis renvoyer `customer` depuis le checkout. Débloque le push invité.
2. **n°1, n°2, n°5** : trois routes publiques à verrouiller (auth, rate-limit, message d'erreur générique).
3. **n°4** : impose `ADMIN_AUTH_SECRET` + vérifie l'expiration du cookie PAM.
4. **n°8** : `and(eq(customers.id…), eq(customers.storeId…))` — correctif d'une ligne.
5. **n°7** : régénérer le journal drizzle et ajouter le test CI de parité schéma/migrations.
6. **n°9** : exempter tous les webhooks du filtre anti-bots.
7. Ensuite : tests d'autorisation (n°10), puis les points 🟡.
