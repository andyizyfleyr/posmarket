# Moyens de paiement par boutique

Chaque boutique configure **ses** moyens d'encaissement, indépendamment des autres boutiques et de la passerelle d'abonnements de la plateforme. Les moyens disponibles sont : **COD** (paiement à la livraison), **Kkiapay**, **FedaPay**, **SasPay** et **USSD**. Les paiements boutiques fonctionnent **en mode production uniquement** : aucune clé de test / sandbox n'est acceptée, ni pour les clés secrètes chiffrées ni pour la clé publique.

Une boutique sans configuration conserve le paiement à la livraison (mécanisme de repli pour ne pas bloquer les commandes).

## Mise en service

1. Appliquer `drizzle/0034_store_payments.sql` à la base (`npm run db:migrate`). La migration crée `store_payment_methods`, `store_payment_credentials`, `order_payments` et ajoute `payment_status`, `payment_reference`, `payment_provider` à `orders`.
2. Configurer `PAYMENT_CREDENTIALS_KEY` dans l'environnement serveur (obligatoire pour enregistrer des secrets en ligne) : 64 caractères hexadécimaux, 32 octets base64, ou une passphrase quelconque (dérivée en SHA-256). Sans cette clé, l'enregistrement d'un secret est refusé plutôt que stocké en clair.
3. Chaque vendeur ouvre **Paramètres → Cartes & paiement / Moyens de paiement de la boutique**, active les moyens souhaités et saisit ses clés **live** (Kkiapay `pk_live_…`/`sk_live_…`, FedaPay `pk_live_…`/`sk_live_…`, SasPay `sk_live_…`). Les secrets sont chiffrés en AES-256-GCM (format `v1:<iv>:<tag>:<ciphertext>`) ; seuls le hint (4 derniers caractères) et les clés publiques reviennent au navigateur.
4. Pour les paiements en ligne, configurer côté fournisseur les webhooks pointant vers les routes habituelles : `/api/kkiapay/webhook`, `/api/fedapay/webhook`, `/api/saspay/webhook`. Ces routes **distinguent désormais les commandes boutiques des abonnements plateforme** : le `partnerId` / jeton `order_payments` fait foi pour les commandes boutiques ; sans correspondance, le traitement historique d'abonnement s'applique.

## Production uniquement

- La configuration publique est assainie par le serveur : `env` y est toujours forcé à `live`, même si la base contient historiquement `env: 'sandbox'`.
- `saveStorePaymentMethod` refuse (message « mode production uniquement ») toute clé ressemblant à une clé de test — `pk_test_…`, `sk_test_…`, `sk_sandbox_…`, … — qu'elle soit nouvellement saisie ou conservée depuis un enregistrement antérieur, que ce soit la clé publique, la clé privée/secrète, la clé API SasPay ou le secret webhook.
- Les appels fournisseurs côté serveur utilisent exclusivement les API de production (`api.kkiapay.me`, `api.fedapay.com`, `api.saspay.me`). Les widgets navigateur sont ouverts en mode live.
- Seules les clés live passent l'initialisation du paiement ; une clé de test enregistrée par erreur bloque l'ouverture du widget avec un message clair.

## Panier multi-boutiques

Le panier marketplace est découpé par boutique ; chaque boutique propose **ses propres** moyens activés. Le client choisit un moyen **différent par boutique** au moment du paiement (sélection stockée par `storeId`). Le serveur revérifie à la commande :

1. le moyen demandé est normalisé (`normalizeStorePaymentProvider` gère les alias historiques `ESPECES`/`CASH`/… et rejette les valeurs inconnues) ;
2. le moyen doit appartenir à la liste des moyens **activés** pour cette boutique (`getEnabledStorePaymentMethods`) — sinon la commande est refusée avant toute décrémentation de stock.

## Cycle d'encaissement (commandes boutiques)

1. Après insertion des commandes (une par boutique), une ligne `order_payments` est créée par boutique (montant, devise XOF, statut `PENDING`, `token` aléatoire non devinable remis au navigateur, `provider_checkout_id` pour SasPay).
2. Initialisation fournisseur :
   - **Kkiapay / FedaPay** : la clé **publique** revient au navigateur ; le widget s'ouvre côté client ; le secret ne quitte jamais le serveur.
   - **SasPay** : la session est créée côté serveur (`/checkout-sessions/`, `return_url` → `/api/store-payments/saspay/return?payment=<id>`), le client est redirigé vers le guichet hébergé.
   - **COD / USSD** : aucune initialisation réseau ; le client paie en main propre (COD) ou compose le code (USSD, instructions affichées).
3. Confirmation :
   - le navigateur appelle `confirmStorePaymentAction(orderId, token, reference?)` **après** le widget ; le serveur revérifie la transaction auprès du fournisseur (statut `SUCCESS`/`approved`, montant exact, `partnerId`/jeton concordant) avant de marquer `orders.payment_status = 'PAID'` ;
   - webhooks : la route retrouve `order_payments` par jeton (`partnerId`), par `reference` ou par `provider_checkout_id` ; si la boutique a configuré un `webhookSecret`, la signature est vérifiée (sinon la vérification API fait foi) ; `order_payments` et `orders` passent à `PAID` et le tag `orders:<storeId>` est invalidé (la liste vendeur voit le badge sans attendre l'expiration des caches) ;
   - retour SasPay (`/api/store-payments/saspay/return`) : revérification côté serveur puis redirection vers l'accueil ; le webhook SasPay balaie aussi les sessions en attente correspondantes ;
   - échec fournisseur : `order_payments.status = 'FAILED'`, `orders.payment_status = 'FAILED'`, motif conservé (`failure_reason`).
4. **COD / USSD** : quand le vendeur marque la commande `COMPLETED`, le serveur passe le paiement boutique en `PAID` (encaissement main propre). Les paiements en ligne ne sont **jamais** marqués payés par cette transition — seul le fournisseur fait foi.
5. La commande est marquée payée **uniquement après vérification serveur**. Un rejeu de webhook est sans effet (transition conditionnelle sur `status = 'PENDING'`).

## Visibilité côté vendeur et acheteur

- **Vendeur** (`/orders`) : badge d'encaissement par commande en ligne (« À encaisser », « Payée », « Échec paiement ») sur la liste et dans le détail (mode, référence fournisseur, rappel de ne pas livrer avant confirmation).
- **Acheteur** (`/mon-compte`) : pastille de paiement sur chaque commande passée en ligne (« Paiement effectué », « Paiement en attente », « À régler à la livraison »…).

## Sécurité

- Les secrets vendeurs ne quittent jamais le serveur : ils sont chiffrés au repos, lus uniquement dans les fonctions serveur (`loadStorePaymentCredential`), jamais renvoyés par les actions publiques (`fetchStorePaymentMethodsAction` ne renvoie que clés publiques / codes USSD / instructions).
- Le `token` `order_payments` autorise uniquement la consultation / confirmation de la commande à laquelle il est rattaché.
- Les montants sont vérifiés au centime près auprès du fournisseur ; toute divergence est rejetée.
- La complétion COD/USSD (`COMPLETED`) est la seule voie hors vérification fournisseur, et elle ne s'applique qu'aux paiements hors ligne.

## Vérification

```bash
npm run check   # journal migrations + rejeu SQL + tsc
npm test        # tests sécurité (dont tests/security/store-payments.test.mjs) + tests saspay
```

Les tests `tests/security/store-payments.test.mjs` verrouillent la politique « production uniquement » (clés de test refusées, `env` toujours `live`, prérequis d'activation, confirmation en échec sans ligne en base).

**Statut de vérification :** aucune clé live n'a été utilisée et aucun paiement réel n'a été exécuté dans cet environnement. La mise en service exige les clés live du vendeur et la déclaration des webhooks chez les fournisseurs.
