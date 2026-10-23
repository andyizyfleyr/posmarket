# Notifications — Catalogue de templates (modèle Shopify)

> Objectif : envoyer la bonne notification, au bon moment, sur le bon canal — comme
> Shopify (« Order confirmation », « Order ready », « New order », « Low stock »…).
>
> Ce document sert de spécification pour le **canal push in-app** à ajouter et
> complète le moteur existant (WhatsApp + e-mail).

---

## 1. Ce qui existe déjà dans le projet

| Brique | Emplacement |
|---|---|
| Registre des 31 événements | `src/lib/notifications.ts` → `NOTIFICATION_EVENTS` |
| Modèle `NotificationEvent` | `src/types.ts` |
| Templates e-mail (objet + HTML + échantillons de prévisualisation) | `src/lib/email.ts` |
| Templates WhatsApp (Meta Cloud API) | `src/lib/whatsapp.ts` |
| Outbox + préférences | tables `notification_outbox`, `notification_preferences` (migrations `0009_email_notifications.sql`) |
| Actions acheteur | `src/lib/notification-actions.ts` + `/api/marketplace/buyer/notifications` |
| Écran « Alertes » web + mobile | `src/components/buyer/NotificationsTab.tsx` (copie mobile : `posmarket-mobile/src/components/buyer/NotificationsTab.tsx`) |
| Module natif mobile | `posmarket-mobile/src/utils/notifications.ts` (`expo-notifications` 0.29.14) — permission + canal Android « Commandes » + notif locale « Commande confirmée » |

**Ce qui manque** : le canal **push serveur → appareil** (Expo Push), le **centre de
notifications in-app** (liste + badge non-lus) et quelques événements Shopify
(absents du registre actuel).

---

## 2. Règles de rédaction

- **Push** : titre ≤ 40 caractères, corps ≤ 120 caractères, **une seule action**.
- **Toujours un deep link** : `data.url` ouvre l'écran concerné au tap.
- **Montants** : FCFA, format `12 000 F CFA` (jamais de centimes).
- **Prénom** si connu, sinon « Bonjour » neutre ; jamais de numéro de téléphone complet dans le corps.
- **Transactionnel** = activé par défaut. **Marketing** (relance panier, promo, baisse de prix) = opt-in explicite.
- Variables entre `{{…}}` : `prenom`, `boutique`, `commande`, `montant`, `articles`, `produit`, `stock`, `note`, `lien`.
- Canaux Android : `orders` (commandes), `stock` (stock vendeur), `account` (compte/abonnement), `promos` (marketing).

### Priorité des canaux

| Type d'événement | Push | WhatsApp | E-mail |
|---|---|---|---|
| Transactionnel critique (commande, paiement) | ✅ immédiat | ✅ | ✅ |
| Suivi (prête, expédiée, livrée, avis) | ✅ | ✅ | ✅ |
| Vendeur (nouvelle commande, stock) | ✅ immédiat | ✅ | ✅ |
| Marketing (relance panier, baisse de prix, retour stock) | ✅ opt-in | ✅ opt-in | ✅ opt-in |

---

## 3. Templates ACHETEUR — cycle de commande

### A1. Bienvenue — `BIENVENUE` ✅ existe
- **Déclencheur** : création de compte acheteur.
- **Push** — *Bienvenue sur PosMarket 👋* / « Découvrez les boutiques vérifiées près de chez vous. »
- **WhatsApp** : « Bonjour {{prenom}} 👋 Bienvenue sur PosMarket ! Des centaines de produits livrés par des commerçants vérifiés. Commencez ici : {{lien}} »
- **E-mail (objet)** : « Bienvenue sur PosMarket »
- **Deep link** : `/`

### A2. Confirmation de commande — `CONFIRMATION_COMMANDE` ✅ existe
- **Déclencheur** : commande créée (paiement validé ou à la livraison).
- **Push** — *Commande #{{commande}} confirmée ✅* / « {{boutique}} prépare {{articles}} article(s) · {{montant}} »
- **WhatsApp** : « Bonjour {{prenom}} 👋 Votre commande #{{commande}} chez {{boutique}} est confirmée. Total : {{montant}}. Suivez-la ici : {{lien}} »
- **E-mail (objet)** : « Confirmation de commande — {{boutique}} »
- **Deep link** : `/account?tab=orders&order={{id}}`
- **Note** : la notif locale mobile existante (`notifyOrderConfirmed`) devient un doublon du push — la débrancher une fois le push serveur actif.

### A3. Reçu de paiement — `RECU_PAIEMENT` ✅ existe
- **Déclencheur** : paiement carte/mobile money confirmé.
- **Push** — *Paiement reçu — {{montant}}* / « Votre commande #{{commande}} est réglée. Merci ! »
- **WhatsApp** : « Paiement de {{montant}} reçu pour la commande #{{commande}}. Reçu disponible : {{lien}} »
- **E-mail (objet)** : « Reçu de paiement — commande #{{commande}} »
- **Deep link** : `/account?tab=orders&order={{id}}`

### A4. Commande prête — `COMMANDE_PRET` ✅ existe
- **Déclencheur** : vendeur marque « Prête » (retrait en boutique).
- **Push** — *Votre commande est prête 🛍️* / « {{boutique}} vous attend. Pensez à votre référence #{{commande}}. »
- **WhatsApp** : « Bonjour {{prenom}}, votre commande #{{commande}} est prête chez {{boutique}}. Adresse et horaires : {{lien}} »
- **E-mail (objet)** : « Votre commande est prête »
- **Deep link** : `/account?tab=orders&order={{id}}`

### A5. Commande expédiée — `COMMANDE_EXPEDIEE` ✅ existe
- **Déclencheur** : vendeur marque « Expédiée ».
- **Push** — *Commande expédiée 🚚* / « #{{commande}} est en route. Suivez la livraison dans l'app. »
- **WhatsApp** : « Votre commande #{{commande}} a été expédiée. Suivi : {{lien}} »
- **E-mail (objet)** : « Votre commande a été expédiée »
- **Deep link** : `/account?tab=orders&order={{id}}`

### A6. Commande livrée — `COMMANDE_LIVREE` ✅ existe
- **Déclencheur** : statut « Livrée ».
- **Push** — *Commande livrée ✅* / « Merci pour votre achat ! Laissez un avis sur {{boutique}}. »
- **WhatsApp** : « Votre commande #{{commande}} a été livrée. Votre avis aide les autres acheteurs : {{lien}} »
- **E-mail (objet)** : « Votre commande a été livrée »
- **Deep link** : `/account?tab=orders&order={{id}}`
- **Astuce** : enchaîner automatiquement avec A9 (demande d'avis) à J+1.

### A7. Commande annulée — `COMMANDE_ANNULEE` ✅ existe
- **Déclencheur** : annulation acheteur ou vendeur.
- **Push** — *Commande #{{commande}} annulée* / « {{boutique}} a annulé votre commande. Détails et remboursement dans l'app. »
- **WhatsApp** : « Votre commande #{{commande}} a été annulée. Si un paiement a été effectué, le remboursement suit son cours. Détails : {{lien}} »
- **E-mail (objet)** : « Votre commande a été annulée »
- **Deep link** : `/account?tab=orders&order={{id}}`

### A8. Remboursement effectué — `REMBOURSEMENT_EFFECTUE` 🆕 à ajouter
- **Déclencheur** : remboursement validé côté paiement.
- **Push** — *Remboursement effectué* / « {{montant}} recrédités pour la commande #{{commande}}. »
- **WhatsApp** : « Le remboursement de {{montant}} (commande #{{commande}}) a été effectué. Comptez 24-72 h selon votre moyen de paiement. »
- **E-mail (objet)** : « Remboursement — commande #{{commande}} »
- **Deep link** : `/account?tab=orders&order={{id}}`

### A9. Demande d'avis — `DEMANDE_AVIS` ✅ existe (template `null` → à créer)
- **Déclencheur** : J+1 après livraison (ou J+2 après retrait).
- **Push** — *Votre avis compte ⭐* / « Comment s'est passé votre achat chez {{boutique}} ? »
- **WhatsApp** : « Bonjour {{prenom}}, votre commande #{{commande}} vous a plu ? Notez {{boutique}} en 30 secondes : {{lien}} »
- **E-mail (objet)** : « Votre avis sur {{boutique}} »
- **Deep link** : `/product/{{slug}}?review=1`
- **Règle** : une seule relance, jamais deux.

### A10. Relance panier abandonné — `RELANCE_PANIER_ABANDONNE` ✅ existe (opt-in)
- **Déclencheur** : panier non converti après 2 h (puis 24 h max).
- **Push** — *Votre panier vous attend 🛒* / « {{articles}} article(s) · {{montant}} chez {{boutique}}. »
- **WhatsApp** : « Bonjour {{prenom}}, vous avez laissé {{articles}} article(s) dans votre panier ({{montant}}). Reprenez où vous en étiez : {{lien}} »
- **E-mail (objet)** : « Votre panier vous attend »
- **Deep link** : `/cart`
- **Règle** : désactivé si la commande est payée entre-temps ; opt-in obligatoire.

### A11. Paiement échoué — `PAIEMENT_ECHOUE` 🆕 à ajouter
- **Déclencheur** : échec du prestataire de paiement.
- **Push** — *Paiement non abouti* / « Votre commande #{{commande}} attend un paiement. Réessayez en 1 tap. »
- **WhatsApp** : « Le paiement de votre commande #{{commande}} n'a pas abouti. Vous pouvez réessayer ici : {{lien}} »
- **E-mail (objet)** : « Paiement non abouti — commande #{{commande}} »
- **Deep link** : `/checkout`
- **Admin** : créer aussi l'événement `PAIEMENT_INCIDENT` (existe) côté plateforme.

---

## 4. Templates ACHETEUR — marketing / réengagement (opt-in)

### M1. Retour en stock — `STOCK_RETOUR` 🆕 à ajouter
- **Déclencheur** : produit demandé (« Me prévenir ») repasse au-dessus de 0.
- **Push** — *De retour en stock 🔔* / « {{produit}} est de nouveau disponible chez {{boutique}}. »
- **WhatsApp** : « Bonne nouvelle ! {{produit}} est de retour en stock chez {{boutique}} : {{lien}} »
- **E-mail (objet)** : « {{produit}} est de retour en stock »
- **Deep link** : `/product/{{slug}}`

### M2. Baisse de prix — `BAISSE_PRIX` 🆕 à ajouter
- **Déclencheur** : prix d'un produit favori / panier baisse d'au moins 5 %.
- **Push** — *Prix en baisse 📉* / « {{produit}} passe à {{montant}} chez {{boutique}}. »
- **WhatsApp** : « {{produit}} est maintenant à {{montant}} (au lieu de {{ancien_montant}}) : {{lien}} »
- **E-mail (objet)** : « Baisse de prix : {{produit}} »
- **Deep link** : `/product/{{slug}}`

### M3. Jalon / fidélité — `JALON_MILESTONE` ✅ existe (opt-in)
- **Déclencheur** : 5e commande, 10e avis, 1 an d'inscription.
- **Push** — *Bravo {{prenom}} 🎉* / « Vous venez d'atteindre {{jalon}} sur PosMarket ! »
- **WhatsApp** : « Félicitations {{prenom}} ! {{jalon}} atteint sur PosMarket. Merci de votre confiance 🎉 »
- **E-mail (objet)** : « Bravo, {{jalon}} atteint ! »
- **Deep link** : `/account`

---

## 5. Templates VENDEUR — opérations

### V1. Nouvelle commande — `NOUVELLE_COMMANDE` ✅ existe
- **Déclencheur** : commande payée sur la boutique.
- **Push** — *Nouvelle commande #{{commande}} 🎉* / « {{articles}} article(s) — {{montant}}. À préparer maintenant. »
- **WhatsApp** : « 🎉 Nouvelle commande #{{commande}} : {{articles}} article(s), {{montant}}. Client : {{client}}. À préparer : {{lien}} »
- **E-mail (objet)** : « Nouvelle commande reçue »
- **Deep link** : `/seller/orders?order={{id}}`

### V2. Commande à préparer (rappel) — `COMMANDE_A_PREPARER` ✅ existe (template `null` → à créer)
- **Déclencheur** : commande non préparée après 30 min (heures ouvrées).
- **Push** — *Commande à préparer ⏰* / « #{{commande}} attend depuis 30 min. Le client est notifié à l'expédition. »
- **WhatsApp** : « Rappel : la commande #{{commande}} ({{montant}}) n'est pas encore préparée. Ouvrir : {{lien}} »
- **E-mail (objet)** : « Nouvelle commande à préparer »
- **Deep link** : `/seller/orders?order={{id}}`

### V3. Nouveau client — `NOUVEAU_CLIENT` ✅ existe
- **Déclencheur** : première commande d'un acheteur sur la boutique.
- **Push** — *Nouveau client 🎉* / « {{prenom}} a commandé pour la première fois chez {{boutique}}. »
- **WhatsApp** : « Nouveau client ! {{prenom}} a passé sa première commande ({{montant}}) chez {{boutique}}. »
- **E-mail (objet)** : « Nouveau client — {{boutique}} »
- **Deep link** : `/seller/orders?order={{id}}`

### V4. Stock bas — `ALERTE_STOCK_BAS` ✅ existe
- **Déclencheur** : stock ≤ seuil (5 par défaut, configurable par produit).
- **Push** — *Stock bas : {{produit}}* / « Il reste {{stock}} unité(s). Réapprovisionnez pour ne pas rater de ventes. »
- **WhatsApp** : « ⚠️ Stock bas : {{produit}} — {{stock}} restant(s). Gérer le stock : {{lien}} »
- **E-mail (objet)** : « Alerte stock bas »
- **Deep link** : `/seller/products?product={{id}}`
- **Règle** : une alerte par franchissement de seuil (pas de spam à chaque vente).

### V5. Rupture de stock — `RUPTURE_STOCK` ✅ existe
- **Déclencheur** : stock passe à 0.
- **Push** — *Rupture : {{produit}}* / « Le produit est masqué des ventes. Réapprovisionnez pour le réactiver. »
- **WhatsApp** : « ❌ Rupture : {{produit}} n'est plus disponible. Réapprovisionner : {{lien}} »
- **E-mail (objet)** : « Rupture de stock — {{produit}} »
- **Deep link** : `/seller/products?product={{id}}`

### V6. Nouvel avis — `NOUVEL_AVIS` ✅ existe (template `null` → à créer)
- **Déclencheur** : avis publié sur un produit de la boutique.
- **Push** — *Nouvel avis {{note}}★* / « {{prenom}} a noté {{produit}}. Répondez pour montrer votre sérieux. »
- **WhatsApp** : « {{prenom}} a laissé un avis {{note}}/5 sur {{produit}}. Lire et répondre : {{lien}} »
- **E-mail (objet)** : « Nouvel avis sur {{produit}} »
- **Deep link** : `/seller/reviews?review={{id}}`

### V7. Vente en boutique (POS) — `VENTE_POS` ✅ existe
- **Déclencheur** : vente encaissée au comptoir.
- **Push** — *Vente encaissée — {{montant}}* / « {{articles}} article(s) vendus sur {{boutique}}. »
- **WhatsApp** : « Vente POS : {{montant}} ({{articles}} article(s)). Reçu : {{lien}} »
- **E-mail (objet)** : « Vente en boutique — {{montant}} »
- **Deep link** : `/seller/pos`

### V8. Facture payée — `FACTURE_PAYEE` ✅ existe
- **Déclencheur** : facture d'abonnement/boost réglée.
- **Push** — *Facture payée ✅* / « {{montant}} réglés. Votre service est actif. »
- **WhatsApp** : « Facture {{facture}} payée ({{montant}}). Merci ! »
- **E-mail (objet)** : « Facture payée — {{montant}} »
- **Deep link** : `/seller/subscription`

### V9. Récap des ventes du jour — `RECAP_VENTES_JOUR` ✅ existe (template `null` → à créer)
- **Déclencheur** : chaque soir à 20 h (fuseau du pays de la boutique).
- **Push** — *Vos ventes aujourd'hui* / « {{commandes}} commande(s) · {{montant}} · panier moyen {{panier_moyen}}. »
- **WhatsApp** : « Récap du jour chez {{boutique}} : {{commandes}} commande(s), {{montant}} encaissés. Détails : {{lien}} »
- **E-mail (objet)** : « Récap des ventes du jour — {{boutique}} »
- **Deep link** : `/seller/dashboard`

### V10. Rapport hebdomadaire — `RAPPORT_VENDEUR_HEBDO` ✅ existe (template `null` → à créer)
- **Déclencheur** : lundi 8 h.
- **Push** — *Votre semaine en 1 chiffre* / « {{montant}} de ventes, {{commandes}} commandes, {{nouveaux_clients}} nouveaux clients. »
- **WhatsApp** : « Rapport de la semaine : {{montant}}, {{commandes}} commandes, {{nouveaux_clients}} nouveaux clients. Détails : {{lien}} »
- **E-mail (objet)** : « Rapport hebdomadaire — {{boutique}} »
- **Deep link** : `/seller/dashboard`

---

## 6. Templates COMPTE / BOUTIQUE / ABONNEMENT / ADMIN

### C1. Compte vérifié — `VERIFICATION_COMPTE_OK` ✅ existe
- **Déclencheur** : validation KYC / vérification vendeur.
- **Push** — *Compte vérifié ✅* / « Votre boutique affiche désormais le badge vérifié. »
- **Deep link** : `/seller`

### C2. Boutique approuvée / rejetée / en attente — `BOUTIQUE_APPROUVEE`, `BOUTIQUE_REJETEE`, `BOUTIQUE_EN_ATTENTE` ✅ existent
- **Push approuvée** — *Votre boutique est en ligne 🎉* / « Ajoutez vos premiers produits et partagez votre lien. »
- **Push rejetée** — *Dossier à compléter* / « Un document manque. Corrigez-le pour être validé. »
- **Push en attente** — *Dossier en cours d'examen* / « Nous revenons vers vous sous 24 h. »
- **Deep link** : `/seller/settings`

### C3. Abonnement — `ABONNEMENT_ACTIVE`, `ABONNEMENT_EXPIRANT`, `ABONNEMENT_EXPIRE` ✅ existent
- **Activé** — *Abonnement {{tier}} activé 🎉* / « Profitez de vos avantages jusqu'au {{date}}. »
- **Expirant** — *Votre abonnement expire dans {{jours}} j* / « Renouvelez pour garder votre visibilité. »
- **Expiré** — *Abonnement expiré* / « Votre boutique reste en ligne, mais les avantages sont suspendus. »
- **Deep link** : `/seller/subscription`

### C4. Admin — `NOUVELLE_INSCRIPTION`, `RAPPORT_ADMIN`, `ALERTE_TECHNIQUE`, `PAIEMENT_INCIDENT`, `RAPPORT_VENDEUR_HEBDO` ✅ existent
- **Nouvelle inscription** — *Nouveau vendeur : {{boutique}}* / « Inscription à examiner dans l'admin. »
- **Paiement incident** — *Incident paiement #{{commande}}* / « {{montant}} en échec — vérifier le prestataire. »
- **Alerte technique** — *Alerte : {{service}}* / « {{message}} »
- **Deep link** : `/admin/notifications`

---

## 7. Nouveaux événements à ajouter au registre

| Événement | Audience | Déclencheur | Priorité |
|---|---|---|---|
| `REMBOURSEMENT_EFFECTUE` | Acheteur | Remboursement validé | P1 |
| `PAIEMENT_ECHOUE` | Acheteur | Échec paiement | P1 |
| `STOCK_RETOUR` | Acheteur | « Me prévenir » + réappro | P2 (opt-in) |
| `BAISSE_PRIX` | Acheteur | Baisse ≥ 5 % sur favori/panier | P3 (opt-in) |
| `REPONSE_VENDEUR` | Acheteur | Vendeur répond à un avis | P3 |
| `LIVRAISON_RETARD` | Acheteur + vendeur | Livraison en retard | P2 |

À créer aussi : les templates `null` déjà présents (`COMMANDE_A_PREPARER`, `DEMANDE_AVIS`, `NOUVEL_AVIS`, `RECAP_VENTES_JOUR`, `RAPPORT_VENDEUR_HEBDO`).

---

## 8. Implémentation du canal push in-app

### 8.1 Base de données (nouvelle migration)

```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);
```

- Ajouter `'push'` au canal des préférences (`notification_preferences.channel`).
- Ajouter `'PUSH'` aux providers de l'outbox (`notification_outbox.provider`).
- Réutiliser `isEventEnabled(userId, phone, event, 'push')` (défaut : activé pour le transactionnel).

### 8.2 Envoi (serveur)

```ts
// src/lib/push.ts
export async function sendPush(userId: string, payload: {
  event: NotificationEvent;
  title: string;
  body: string;
  data?: { url?: string; orderId?: string; productSlug?: string };
  channelId?: 'orders' | 'stock' | 'account' | 'promos';
}): Promise<void> { /* POST https://exp.host/--/api/v2/push/send */ }
```

- Une ligne `notification_outbox` par envoi (`provider: 'PUSH'`, statut `SENT`/`FAILED`) → l'historique « Alertes » reste la source de vérité.
- Gérer les tokens invalides (`DeviceNotRegistered`) en désactivant le token.
- Réutiliser le registre `NOTIFICATION_EVENTS` (label + opt-in) et les échantillons de `email.ts` pour la prévisualisation admin.

### 8.3 Mobile (`posmarket-mobile`)

1. **Enregistrement** : après connexion, `Notifications.getExpoPushTokenAsync({ projectId })` → `POST /api/marketplace/push-token` (upsert par token).
2. **Tap** : `addNotificationResponseReceivedListener` → `router.push(data.url)`.
3. **Badge** : compteur de non-lus (table `notifications` in-app ou dérivé de l'outbox) sur l'icône cloche du header.
4. **Centre in-app** : nouvel onglet/liste « Notifications » (réutiliser `NotificationsTab`, ajouter la liste des non-lus au-dessus de l'historique).
5. **Canaux Android** dans `src/utils/notifications.ts` : `orders`, `stock`, `account`, `promos`.

> ⚠️ SDK 52 : le push distant nécessite un **development build** (`expo-notifications` n'est pas garanti dans Expo Go selon la plateforme). L'Expo Go du Play Store est en SDK 57 → impossible pour l'app actuelle ; tester via `npx expo run:android` ou EAS.

### 8.4 Deep links par événement

| Destination | URL |
|---|---|
| Commande acheteur | `/account?tab=orders&order={{id}}` |
| Panier | `/cart` |
| Checkout | `/checkout` |
| Fiche produit | `/product/{{slug}}` |
| Boutique | `/store/{{slug}}` |
| Commandes vendeur | `/seller/orders?order={{id}}` |
| Produits vendeur | `/seller/products?product={{id}}` |
| Avis vendeur | `/seller/reviews?review={{id}}` |
| Abonnement | `/seller/subscription` |
| Tableau de bord | `/seller/dashboard` |

---

## 9. Ordre de mise en œuvre proposé

| Phase | Contenu | Résultat |
|---|---|---|
| **1** | Migration `push_tokens` + `PUSH` outbox + `sendPush` + enregistrement mobile + deep links | Le push serveur fonctionne sur les 6 événements transactionnels acheteur |
| **2** | Templates vendeur (nouvelle commande, à préparer, stock bas/rupture, nouvel avis) + canal `stock` | Le vendeur est alerté en temps réel |
| **3** | Centre in-app + badge non-lus + préférences push | Parité Shopify côté app |
| **4** | Marketing opt-in (panier abandonné, retour stock, baisse de prix) + nouveaux événements | Réengagement |

---

## 10. Exemple de charge utile Expo Push

```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Nouvelle commande #1042 🎉",
  "body": "2 articles — 12 000 F CFA. À préparer maintenant.",
  "sound": "default",
  "channelId": "orders",
  "data": {
    "event": "NOUVELLE_COMMANDE",
    "orderId": "9f1c…",
    "url": "/seller/orders?order=9f1c…"
  }
}
```
