# Notifications — catalogue et état d'implémentation

> Modèle Shopify : la bonne notification, au bon moment, sur le bon canal.
> Les textes ci-dessous sont ceux réellement envoyés (push, WhatsApp, e-mail) :
> pas d'emoji, pas de dièse, uniquement du texte simple.

---

## 1. Ce qui est en place

| Brique | Emplacement |
|---|---|
| Registre des 32 événements | `src/lib/notifications.ts` → `NOTIFICATION_EVENTS` |
| Modèle `NotificationEvent` | `src/types.ts` |
| Textes push par événement | `src/lib/push-templates.ts` → `buildPushContent()` |
| Envoi Expo Push | `src/lib/push.ts` → `sendPush()` |
| Jetons d'appareils | table `push_tokens` (migration `drizzle/0024_push_tokens.sql`) |
| API jeton mobile | `POST/DELETE /api/marketplace/push-token` |
| Templates e-mail | `src/lib/email.ts` |
| Répartition des canaux | `notify()` dans `src/lib/notifications.ts` |
| Préférences + historique | `src/lib/notification-actions.ts`, `/api/marketplace/buyer/notifications` |
| Écran Alertes mobile | `posmarket-mobile/src/components/buyer/NotificationsTab.tsx` |
| Enregistrement du jeton mobile | `posmarket-mobile/src/components/PushNotifications.tsx` |
| Canaux Android | `posmarket-mobile/src/utils/notifications.ts` |

Le push serveur est actif pour tous les événements qui appellent `notify()` avec un
`userId`. Les événements marketing restent désactivés par défaut (opt-in).

Ce qui reste à faire : le badge de non-lus du centre in-app (l'historique existe
déjà), et les déclencheurs des événements qui dépendent d'une fonctionnalité
produit absente (remboursement, favoris, liste d'attente, réponse vendeur,
suivi de livraison).

---

## 2. Règles de rédaction

- Pas d'emoji, pas de dièse : une référence s'écrit `Commande 1042`, jamais avec un dièse devant le numéro.
- Titre court, corps en une phrase, une seule action.
- Montants en FCFA : `12 000 FCFA`.
- Jamais de numéro de téléphone complet dans le corps.
- Chaque push porte un deep link (`data.url`) vers l'écran concerné.
- Transactionnel activé par défaut. Marketing (relance panier, promo, baisse de
  prix) : opt-in explicite par événement et par canal.
- Canaux Android : `orders` (commandes), `stock` (stock vendeur),
  `account` (compte, abonnement, avis, rapports), `promos` (marketing).

### Matrice des canaux

| Type d'événement | Push | WhatsApp | E-mail |
|---|---|---|---|
| Transactionnel (commande, paiement) | oui, immédiat | si configuré | si configuré |
| Suivi (prête, livrée, avis) | oui | si configuré | si configuré |
| Vendeur (commande, stock, avis) | oui, immédiat | si configuré | si configuré |
| Marketing (panier, promo) | opt-in | opt-in | opt-in |

---

## 3. Événements acheteur — cycle de commande

### A1. Bienvenue — `BIENVENUE` (actif)
- Déclencheur : création de compte.
- Push : « Bienvenue sur PosMarket » / « Votre compte est créé. Découvrez les boutiques près de vous. »
- Deep link : `/`
- Canaux : push, e-mail, fil in-app.

### A2. Confirmation de commande — `CONFIRMATION_COMMANDE` (actif)
- Déclencheur : commande créée.
- Push : « Commande 1042 » / « Ma Belle Boutique a bien reçu votre commande de 12 000 FCFA. »
- Deep link : `/account?tab=orders&order={{id}}`
- Canaux : push, WhatsApp, e-mail, fil in-app.

### A3. Reçu de paiement — `RECU_PAIEMENT` (gabarit prêt)
- Déclencheur : paiement carte ou mobile money confirmé.
- Push : « Reçu de paiement » / « Paiement de 12 000 FCFA confirmé pour la commande 1042. »
- Deep link : `/account?tab=orders&order={{id}}`
- Non déclenché aujourd'hui : le checkout encaisse en espèces. À brancher sur le
  futur parcours carte.

### A4. Commande prête — `COMMANDE_PRET` (actif)
- Déclencheur : le vendeur passe la commande au statut `READY`.
- Push : « Commande 1042 » / « Votre commande est prête chez Ma Belle Boutique. Vous pouvez venir la récupérer. »
- Deep link : `/account?tab=orders&order={{id}}`

### A5. Commande expédiée — `COMMANDE_EXPEDIEE` (gabarit prêt)
- Déclencheur : statut « expédiée ».
- Push : « Commande 1042 » / « Votre commande a été expédiée par Ma Belle Boutique. »
- Deep link : `/account?tab=orders&order={{id}}`
- Non déclenché : le parcours actuel s'arrête à `READY` puis `COMPLETED`.

### A6. Commande livrée — `COMMANDE_LIVREE` (actif)
- Déclencheur : statut `COMPLETED`.
- Push : « Commande 1042 » / « Votre commande a bien été livrée. Merci pour votre achat. »
- Deep link : `/account?tab=orders&order={{id}}`

### A7. Commande annulée — `COMMANDE_ANNULEE` (actif)
- Déclencheur : annulation par l'acheteur ou le vendeur.
- Push : « Commande 1042 » / « Ma Belle Boutique a annulé votre commande. Contactez la boutique pour toute question. »
- Deep link : `/account?tab=orders&order={{id}}`

### A8. Remboursement effectué — `REMBOURSEMENT_EFFECTUE` (à ajouter)
- Déclencheur : remboursement validé côté paiement.
- Texte prévu : « Remboursement effectué » / « 12 000 FCFA recrédités pour la commande 1042. »
- Nécessite d'abord un parcours de remboursement côté paiement.

### A9. Demande d'avis — `DEMANDE_AVIS` (actif)
- Déclencheur : 15 minutes après la livraison, puis relance à J+2 par le cron.
  Une seule demande par commande grâce au marqueur `order-XXXX`.
- Push : « Votre avis compte » / « Partagez votre expérience chez Ma Belle Boutique en laissant un avis sur vos produits. »
- Deep link : `/account?tab=orders&order={{id}}`
- Canaux : push (si compte), e-mail, fil in-app.

### A10. Relance panier abandonné — `RELANCE_PANIER_ABANDONNE` (actif, opt-in)
- Déclencheur : panier non converti, envoi programmé après 24 h.
- Push : « Votre panier vous attend » / « Finalisez votre commande en quelques instants pour 12 000 FCFA. »
- Deep link : `/cart`
- Opt-in obligatoire, désactivé par défaut.

### A11. Paiement échoué — `PAIEMENT_ECHOUE` (actif)
- Déclencheur : webhook Kkiapay, FedaPay ou FeexPay en échec.
- Push : « Paiement non abouti » / « Votre paiement de 12 000 FCFA n'a pas abouti. Réessayez depuis votre espace abonnement. »
- Deep link : `/seller/subscription`
- L'admin reçoit en parallèle `PAIEMENT_INCIDENT` par e-mail.

---

## 4. Événements acheteur — marketing (opt-in)

### M1. Retour en stock — `STOCK_RETOUR` (à ajouter)
- Déclencheur : produit demandé via « Me prévenir » repasse au-dessus de 0.
- Texte prévu : « De retour en stock » / « Huile d'arachide est de nouveau disponible chez Ma Belle Boutique. »
- Nécessite une table de liste d'attente produit.

### M2. Baisse de prix — `BAISSE_PRIX` (à ajouter)
- Déclencheur : prix d'un produit favori en baisse d'au moins 5 %.
- Texte prévu : « Prix en baisse » / « Huile d'arachide passe à 2 000 FCFA chez Ma Belle Boutique. »
- Nécessite une table de favoris.

### M3. Jalon — `JALON_MILESTONE` (gabarit prêt, opt-in)
- Déclencheur prévu : 5e commande, 10e avis, 1 an d'inscription.
- Push : « Jalon atteint » / « Nouveau palier : 10 commandes. Continuez sur votre lancée. »
- Deep link : `/seller/dashboard`
- Le compteur de jalons n'existe pas encore.

---

## 5. Événements vendeur — opérations

### V1. Nouvelle commande — `NOUVELLE_COMMANDE` (actif)
- Déclencheur : commande créée dans la boutique.
- Push : « Nouvelle commande 1042 » / « Awa a commandé 2 articles pour 12 000 FCFA. »
- Deep link : `/seller/orders?order={{id}}`
- Canaux : push, WhatsApp, e-mail, fil in-app.

### V2. Commande à préparer — `COMMANDE_A_PREPARER` (gabarit prêt)
- Déclencheur prévu : commande non préparée après 30 minutes.
- Push : « Commande à préparer » / « La commande 1042 attend d'être préparée. »
- Deep link : `/seller/orders?order={{id}}`
- Le rappel planifié n'est pas encore branché.

### V3. Nouveau client — `NOUVEAU_CLIENT` (actif)
- Déclencheur : première commande d'un acheteur.
- Push : « Nouveau client » / « Awa vient de passer sa première commande. »
- Deep link : `/seller/customers`

### V4. Stock bas — `ALERTE_STOCK_BAS` (actif)
- Déclencheur : stock inférieur ou égal à 10 après une commande.
- Push : « Stock bas » / « Huile d'arachide : 3 unités restantes. Pensez à réapprovisionner. »
- Deep link : `/seller/inventory`

### V5. Rupture de stock — `RUPTURE_STOCK` (actif)
- Déclencheur : stock passé à 0.
- Push : « Rupture de stock » / « Huile d'arachide est épuisé. Réapprovisionnez pour continuer à vendre. »
- Deep link : `/seller/inventory`

### V6. Nouvel avis — `NOUVEL_AVIS` (actif)
- Déclencheur : avis publié sur un produit.
- Push : « Nouvel avis » / « Riz parfumé a reçu une note de 5 sur 5. »
- Deep link : `/seller/dashboard`

### V7. Vente en boutique — `VENTE_POS` (actif)
- Déclencheur : vente encaissée au comptoir ou vente boost.
- Push : « Vente en boutique » / « 2 articles vendus pour 7 500 FCFA. »
- Deep link : `/seller/orders`

### V8. Facture payée — `FACTURE_PAYEE` (actif)
- Déclencheur : paiement d'abonnement confirmé (Kkiapay, FedaPay, FeexPay).
- Push : « Facture payée » / « Votre paiement de 9 900 FCFA a été confirmé. »
- Deep link : `/seller/subscription`

### V9. Récap des ventes du jour — `RECAP_VENTES_JOUR` (actif)
- Déclencheur : cron quotidien, une fois par boutique.
- Push : « Récap des ventes — Ma Belle Boutique » / « 4 commandes aujourd'hui pour 28 000 FCFA. »
- Deep link : `/seller/dashboard`
- Destinataires : propriétaire en push, staff par e-mail.

### V10. Rapport hebdomadaire — `RAPPORT_VENDEUR_HEBDO` (actif)
- Déclencheur : lundi, cron hebdomadaire.
- Push : « Rapport hebdomadaire — Ma Belle Boutique » / « 18 commandes cette semaine pour 126 000 FCFA. »
- Deep link : `/seller/dashboard`
- Destinataires : propriétaire en push, e-mail de la boutique.

---

## 6. Compte, boutique, abonnement, admin

### C1. Compte vérifié — `VERIFICATION_COMPTE_OK` (gabarit prêt)
- Déclencheur prévu : validation KYC.
- Push : « Compte vérifié » / « Votre compte est vérifié. Toutes les fonctionnalités sont disponibles. »
- Deep link : `/seller`
- Aucun parcours de vérification n'existe encore.

### C2. Boutique — `BOUTIQUE_APPROUVEE`, `BOUTIQUE_REJETEE`, `BOUTIQUE_EN_ATTENTE`
- Approuvée (actif) : « Boutique approuvée » / « Ma Belle Boutique est en ligne. Vous pouvez recevoir des commandes. »
- Rejetée (actif) : « Boutique refusée » / « Votre boutique n'a pas été validée. Consultez votre espace pour corriger les informations. »
- En attente : e-mail aux admins uniquement (pas de compte mobile admin).
- Deep link vendeur : `/seller`

### C3. Abonnement — `ABONNEMENT_ACTIVE`, `ABONNEMENT_EXPIRANT`, `ABONNEMENT_EXPIRE`
- Activé (actif) : « Abonnement activé » / « Votre formule PRO (mensuel) est active. »
- Expirant (actif) : « Abonnement expirant » / « Votre formule PRO expire dans 7 jours. Renouvelez-la pour garder votre boutique en ligne. »
- Expiré (actif) : « Abonnement expiré » / « Choisissez une nouvelle formule pour réactiver votre boutique. »
- Deep link : `/seller/subscription`

### C4. Admin — e-mail uniquement
- `NOUVELLE_INSCRIPTION`, `RAPPORT_ADMIN`, `ALERTE_TECHNIQUE`, `PAIEMENT_INCIDENT`,
  `BOUTIQUE_EN_ATTENTE`.
- Ces appels ne portent pas de `userId` mobile : ils partent par e-mail (et
  WhatsApp si configuré). Aucun espace admin n'existe dans l'application.

---

## 7. Événements non branchés

| Événement | Audience | Déclencheur | Prérequis |
|---|---|---|---|
| `REMBOURSEMENT_EFFECTUE` | Acheteur | Remboursement validé | Parcours de remboursement |
| `STOCK_RETOUR` | Acheteur | « Me prévenir » + réappro | Liste d'attente produit |
| `BAISSE_PRIX` | Acheteur | Baisse de 5 % sur un favori | Table de favoris |
| `REPONSE_VENDEUR` | Acheteur | Réponse du vendeur à un avis | Action de réponse aux avis |
| `LIVRAISON_RETARD` | Acheteur + vendeur | Livraison en retard | Suivi de livraison avec ETA |
| `JALON_MILESTONE` | Acheteur | Palier atteint | Compteur de jalons |
| `COMMANDE_A_PREPARER` | Vendeur | Commande non préparée | Rappel planifié annulable |
| `RECU_PAIEMENT` | Acheteur | Paiement carte/mobile money | Checkout carte |

Les gabarits push de ces événements existent déjà dans `buildPushContent()` :
le jour où le déclencheur est ajouté, `notify()` l'envoie sans autre travail.

---

## 8. Fonctionnement du canal push

### 8.1 Base de données

Migration `drizzle/0024_push_tokens.sql` :

```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text DEFAULT 'android' NOT NULL,
  device_name text,
  enabled boolean DEFAULT true NOT NULL,
  last_seen_at timestamp DEFAULT now() NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);
```

Un utilisateur peut avoir plusieurs appareils. À la connexion, l'upsert réactive
le jeton existant. À la déconnexion, l'application appelle `DELETE
/api/marketplace/push-token` avant d'effacer la session.

### 8.2 Répartition dans `notify()`

1. Calcule les canaux disponibles : WhatsApp configuré, e-mail configuré, jetons
   push actifs.
2. Vérifie les préférences par canal (`notification_preferences.channel = 'push'`).
   Le transactionnel est actif par défaut, le marketing est inactif par défaut.
3. Rend le texte push avec `buildPushContent(eventType, { title, body, emailData })`.
4. Insère une ligne `notification_outbox` (`provider: 'push'`) puis l'envoie
   immédiatement, ou la programme si `scheduledAt` est futur.
5. Quand un push est envoyé, la ligne push remplace la ligne in-app : une seule
   entrée par événement dans l'historique.
6. En cas d'échec : `PENDING` puis nouvelle tentative (3 maximum), puis `FAILED`.

L'historique « Alertes » affiche les lignes push avec l'icône cloche.

### 8.3 Envoi Expo

```ts
// src/lib/push.ts
export async function sendPush(userId: string, payload: {
  title: string;
  body: string;
  url?: string;
  channelId?: 'orders' | 'stock' | 'account' | 'promos';
}): Promise<PushResult>;
```

- POST `https://exp.host/--/api/v2/push/send`, une requête pour tous les
  appareils de l'utilisateur.
- Timeout de 10 secondes.
- Les jetons `DeviceNotRegistered` sont désactivés automatiquement.
- Aucune clé serveur n'est nécessaire pour Expo Push.

### 8.4 Application mobile

1. `PushNotifications` (layout racine) demande la permission à la connexion.
2. `getExpoPushToken()` utilise `Constants.expoConfig.extra.eas.projectId`.
3. Le jeton est envoyé à `POST /api/marketplace/push-token`.
4. Au clic, `addNotificationResponseReceivedListener` ouvre `data.url`.
5. `getLastNotificationResponseAsync()` couvre l'ouverture depuis une app fermée.
6. Canaux Android créés : `orders`, `stock`, `account`, `promos`.

> SDK 52 : le push distant exige un development build
> (`npx expo run:android` ou EAS). L'Expo Go du Play Store est en SDK 57 et ne
> peut pas exécuter cette application.

### 8.5 Deep links

| Destination | URL |
|---|---|
| Commandes acheteur | `/account?tab=orders&order={{id}}` |
| Panier | `/cart` |
| Checkout | `/checkout` |
| Fiche produit | `/product/{{slug}}` |
| Boutique | `/store/{{slug}}` |
| Commandes vendeur | `/seller/orders?order={{id}}` |
| Stock vendeur | `/seller/inventory` |
| Clients vendeur | `/seller/customers` |
| Tableau de bord / avis | `/seller/dashboard` |
| Abonnement | `/seller/subscription` |
| Boutique (réglages) | `/seller/settings` |

---

## 9. Où modifier un texte

- Push : `src/lib/push-templates.ts`, entrée de l'événement.
- E-mail : `src/lib/email.ts` (`SUBJECTS` + `renderers`).
- WhatsApp : `src/lib/whatsapp.ts` (templates Meta) ou corps de secours fourni
  par l'appelant de `notify()`.
- Destinataire ou moment d'envoi : l'appel `notify()` dans l'action concernée.

Tout nouveau texte doit rester sans emoji ni dièse.
