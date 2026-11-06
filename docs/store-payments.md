# Moyens de paiement par boutique

Chaque boutique configure **ses** moyens d'encaissement, indépendamment des autres boutiques et de la passerelle d'abonnements de la plateforme. Les moyens disponibles sont : **COD** (paiement à la livraison), **Kkiapay** et **FedaPay** (SasPay et USSD ont été retirés : aucune nouvelle activation possible ; l'historique et les réconciliations restent supportés). Les boutiques fonctionnent **en production par défaut** ; chaque boutique peut basculer ses moyens en ligne en **Sandbox** (tests) depuis sa popup de configuration — en Sandbox, seules les clés de test sont acceptées (les clés live sont refusées), le widget s'ouvre en mode sandbox et la vérification API utilise les hôtes de test (Kkiapay `api-sandbox.kkiapay.me`, FedaPay `sandbox-api.fedapay.com`).

Une boutique sans configuration conserve le paiement à la livraison (mécanisme de repli pour ne pas bloquer les commandes).

## Mise en service

1. Appliquer `drizzle/0034_store_payments.sql` à la base (`npm run db:migrate`). La migration crée `store_payment_methods`, `store_payment_credentials`, `order_payments` et ajoute `payment_status`, `payment_reference`, `payment_provider` à `orders`.
2. Configurer `PAYMENT_CREDENTIALS_KEY` dans l'environnement serveur (recommandé pour les secrets en ligne) : `node scripts/generate-payment-key.mjs` affiche une clé prête à l'emploi (64 caractères hexadécimaux). Sont aussi acceptés : 32 octets base64 ou une passphrase (dérivée en SHA-256). À défaut, l'application dérive une clé dédiée de `AUTH_SECRET` / `NEXTAUTH_SECRET` avec un contexte de dérivation propre (jamais la clé de session elle-même) et le consigne dans les logs ; sans aucun secret dans l'environnement, l'enregistrement est refusé plutôt que stocké en clair. Attention : si une clé dédiée était définie puis retirée de l'environnement, les secrets déjà chiffrés deviennent illisibles — la boutique doit alors ressaisir ses clés.
3. Chaque vendeur ouvre **Paramètres → Cartes & paiement / Moyens de paiement de la boutique**, active les moyens souhaités et saisit ses clés **live** (Kkiapay `pk_live_…`/`sk_live_…`, FedaPay `pk_live_…`/`sk_live_…`). Les secrets sont chiffrés en AES-256-GCM (format `v1:<iv>:<tag>:<ciphertext>`) ; seuls le hint (4 derniers caractères) et les clés publiques reviennent au navigateur.
4. Pour les paiements en ligne, configurer côté fournisseur les webhooks pointant vers les routes habituelles : `/api/kkiapay/webhook`, `/api/fedapay/webhook`, `/api/saspay/webhook`. Ces routes **distinguent désormais les commandes boutiques des abonnements plateforme** : le `partnerId` / jeton `order_payments` fait foi pour les commandes boutiques ; sans correspondance, le traitement historique d'abonnement s'applique.

## Environnements : production par défaut, Sandbox au choix

- Chaque moyen en ligne (Kkiapay, FedaPay) d'une boutique porte un **mode** `env` (`live` par défaut, `sandbox` au choix), réglé dans la popup de configuration (« Mode : Production / Sandbox ») et conservé tel quel en base.
- En **Production** (défaut) : les clés ressemblant à des clés de test — `pk_test_…`, `sk_test_…`, `sk_sandbox_…`, … — sont refusées, qu'elles soient saisies ou conservées d'un enregistrement antérieur (clé publique, clés privée/secrète, secret webhook). Les widgets et la vérification API utilisent les hôtes de production (`api.kkiapay.me`, `api.fedapay.com`).
- En **Sandbox** : seules les clés de test sont acceptées — toute clé portant le marqueur `live` (`pk_live_…`, `sk_live_…`, `wh_live_…`) est refusée afin qu'aucune vraie transaction ne parte par erreur. Les widgets s'ouvrent en mode sandbox (Kkiapay `sandbox: true`, FedaPay `environment: 'sandbox'`) et la vérification serveur utilise les hôtes de test (`api-sandbox.kkiapay.me`, `sandbox-api.fedapay.com/v1`).
- Le mode ne s'inverse pas tout seul : une clé incohérente avec le mode choisi est refusée à l'enregistrement avec un message clair. La boutique voit un badge « Sandbox » sur sa liste de moyens quand le mode test est actif.
- SasPay / USSD : toujours retirés pour les nouvelles commandes (les commandes historiques restent supportées en production).

## Panier multi-boutiques

Le panier marketplace est découpé par boutique ; chaque boutique propose **ses propres** moyens activés. Moyens proposés : **COD, Kkiapay, FedaPay** (SasPay et USSD ont été retirés — aucune nouvelle activation possible ; les commandes historiques, webhooks et réconciliations SasPay/USSD restent supportés pour l'existant). Le client choisit un moyen **différent par boutique** au moment du paiement (sélection stockée par `storeId`). Le serveur revérifie à la commande :

1. le moyen demandé est normalisé (`normalizeStorePaymentProvider` gère les alias historiques `ESPECES`/`CASH`/… et rejette les valeurs inconnues) ;
2. le moyen doit appartenir à la liste des moyens **activés** pour cette boutique (`getEnabledStorePaymentMethods`) — sinon la commande est refusée avant toute décrémentation de stock.

## Cycle d'encaissement (commandes boutiques)

0. **Côté tunnel acheteur** (« paiement avant commande ») : dès qu'un moyen en ligne (Kkiapay/FedaPay) est sélectionné, le bouton de confirmation devient **« Payer »**. Au clic, **aucune commande n'est créée** : le navigateur appelle `quoteCheckoutAction` (devis lecture seule — montants canoniques calculés serveur, prix/coupon/livraison —, aucune écriture), ouvre le widget du fournisseur **par-dessus la page paiement** (plusieurs boutiques en ligne ⇒ widgets séquentiels), récupère les justificatifs (id de transaction Kkiapay, id/référence FedaPay), puis appelle `submitCheckoutAction(..., prepaidProofs)`. Le serveur **revérifie chaque preuve auprès du fournisseur avant la moindre écriture** (statut, montant exact arrondi, référence, `partnerId` = clé d'idempotence pour Kkiapay). Si une seule vérification échoue ou manque, **rien n'est enregistré** (ni commande, ni lignes, ni stock, ni compteurs) et le client reçoit un message invitant à contacter le support avec la référence si le montant a été débité. Les commandes 100 % COD partent directement, sans devis ni widget. La page **Commande réussie** s'affiche dès que les commandes sont enregistrées — elles sont créées directement en `PAID` pour les boutiques pré-payées. Aucun écran intermédiaire n'est affiché entre le clic sur « Payer » et le widget.

1. Après insertion des commandes (une par boutique), une ligne `order_payments` est créée par boutique (montant, devise XOF, statut `PENDING` — `PAID` + référence dès la création pour les boutiques réglées d'avance), `token` aléatoire non devinable, `provider_checkout_id` pour SasPay). Pour les boutiques réglées d'avance, la preuve fournie est re-vérifiée côté serveur AVANT le lot d'insertion ; l'initialisation fournisseur post-commit (étape 2) est ignorée pour elles.
2. Initialisation fournisseur :
   - **Kkiapay / FedaPay** : la clé **publique** revient au navigateur ; le widget s'ouvre côté client ; le secret ne quitte jamais le serveur.
   - **COD** : aucune initialisation réseau ; le client paie en main propre (encaissement marqué à la validation vendeur).
   - *(SasPay / USSD : retirés pour les nouvelles commandes ; les flux existants restent décrits dans le code des routes webhook/retour.)*
3. Confirmation :
   - le navigateur appelle `confirmStorePaymentAction(orderId, token, reference?)` **après** le widget ; le serveur revérifie la transaction auprès du fournisseur (statut `SUCCESS`/`approved`, montant exact, `partnerId`/jeton concordant) avant de marquer `orders.payment_status = 'PAID'` ;
   - webhooks : la route retrouve `order_payments` par jeton (`partnerId`), par `reference` ou par `provider_checkout_id` ; si la boutique a configuré un `webhookSecret`, la signature est vérifiée (sinon la vérification API fait foi) ; `order_payments` et `orders` passent à `PAID` et le tag `orders:<storeId>` est invalidé (la liste vendeur voit le badge sans attendre l'expiration des caches) ;
   - retour SasPay (`/api/store-payments/saspay/return`) : revérification côté serveur puis redirection vers l'accueil ; le webhook SasPay balaie aussi les sessions en attente correspondantes ;
   - échec fournisseur : `order_payments.status = 'FAILED'`, `orders.payment_status = 'FAILED'`, motif conservé (`failure_reason`).
4. **COD / USSD** : quand le vendeur marque la commande `COMPLETED`, le serveur passe le paiement boutique en `PAID` (encaissement main propre ; USSD ne concerne que les commandes historiques). Les paiements en ligne ne sont **jamais** marqués payés par cette transition — seul le fournisseur fait foi.
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

Les tests `tests/security/store-payments.test.mjs` verrouillent la politique des environnements : clés de test refusées en production (défaut), clés live refusées en Sandbox, `env` conservé tel que choisi par la boutique, prérequis d'activation, confirmation en échec sans ligne en base.

**Statut de vérification :** aucune clé live n'a été utilisée et aucun paiement réel n'a été exécuté dans cet environnement. La mise en service exige les clés live du vendeur et la déclaration des webhooks chez les fournisseurs.
