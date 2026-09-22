# PLAN — Notifications email (NodeMailer + SMTP Gmail)

Départ Gmail via SMTP (node-mailer). Les clés SMTP/Google sont configurées **manuellement dans les paramètres admin** (`/pam/settings`, table `system_settings`), mêmes mécanique que les clés KkiaPay/FedaPay déjà gérées dans `src/app/actions/admin.ts`.

## Architecture

Réutiliser le pattern outbox existant (`notification_outbox` + `notification_preferences`), déjà multi-provider :

- `notification_outbox` : + `recipient_email` ; `provider = 'whatsapp' | 'email'`.
- `notification_preferences` : + `email` ; canal `'whatsapp' | 'email'`.
- `notify()` : routage — email si adresse dispo, sinon fallback WhatsApp, opt-in inchangé (transactionnel on / marketing opt-in).
- Cron `/api/cron/notifications` : `processDueNotifications()` gère les 2 providers + retries (< 3) + digest planifiés.

## Étape 0 — Config SMTP Gmail (admin settings)
- Extension de `SystemSettingsData` (`admin.ts`) avec : `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass` (masqué, champ password), `smtp_from`, `admin_emails`.
- Champs ajoutés au formulaire `/pam/settings` (même pattern que les clés paiement).
- `.env.local` / `.env.example` : valeurs de repli `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ADMIN_EMAILS`. Le DB l'emporte sur l'env.

## Étape 1 — Migration Drizzle
- `notification_outbox` : `recipient_email` (text).
- `notification_preferences` : `email` (text).
- Index sur `(status, provider)`.

## Étape 2 — Types (`src/types.ts`)
Nouveaux `NotificationEvent` :
- `DEMANDE_AVIS` (client)
- `NOUVEL_AVIS` (vendeur)
- `BOUTIQUE_EN_ATTENTE` (admin)
- `RAPPORT_VENDEUR_HEBDO` (vendeur)
- `RAPPORT_ADMIN` (admin)
- `RECAP_VENTES_JOUR` (staff)
- `ALERTE_TECHNIQUE`, `PAIEMENT_INCIDENT` (admin)
- `COMMANDE_A_PREPARER` (staff)

`provider` de l'outbox : `'whatsapp' | 'email'`.

## Étape 3 — `src/lib/email.ts` (nouveau)
- Transporteur NodeMailer (`smtp.gmail.com`, port 465, SSL ; config lue depuis `system_settings` avec repli env).
- `isEmailConfigured()`, `sendEmail(to, subject, html, attachments)`.
- Rendus de templates HTML inline responsive ; sujet par événement.

## Étape 4 — `src/lib/notifications.ts`
- `NOTIFICATION_EVENTS` : + `subject`, `emailTemplate`.
- `NotifyInput` : + `email` / `recipientEmail`.
- `deliverOutboxRow()` : prise en charge `provider === 'email'`, attach facture PDF sur `RECU_PAIEMENT`.
- Helpers : `getStoreEmail()`, `getProfileEmail()`, `getAdminEmails()` (admin_users.email + `system_settings.admin_emails`), `notifyStaff(storeId, event, params)` (store_staff → profiles.email).

## Étape 5 — Intégration par rôle
- **Client** (buyer_email / email profil / customer.email) : confirmation commande, prête, expédiée, livrée, annulée, reçu paiement (+ PDF), relance panier, bienvenue, **demande d'avis** à `COMPLETED`.
- **Vendeur** (`stores.email`) : nouvelle commande, nouveau client, stock bas/rupture, **nouvel avis** (`saveProductReviewAction`), boutique approuvée/rejetée, facture payée, abonnement actif/expirant/expiré, **rapport hebdo**.
- **Staff** : **commande à préparer** (nouvelle commande en ligne), commande prête, stock bas/rupture, **récap ventes du jour**.
- **Admin** : nouvelle inscription, **boutique en attente** (approbation), `ALERTE_TECHNIQUE` + `PAIEMENT_INCIDENT` (erreurs webhook), **rapports**.

## Étape 6 — Cron `/api/cron/notifications`
- Repo `/api/cron/whatsapp` ; `processDueNotifications()` gère les 2 providers.
- Jobs : rapport vendeur (lun. 8h), rapport admin (dim.), récap staff (20h), demande d'avis (J+2 post-livraison).

## Étape 7 — Préférences UI
- Dashboard vendeur + mon-compte : toggles email/WhatsApp par `eventType` (`notification_preferences`, `channel='email'`).

## Étape 8 — Vérifications
- `npm run lint`, `npm run db:generate` + `db:migrate`, test envoi Gmail, `.env.example` à jour.

## Notes / risques
- Gmail SMTP ~500 mails/jour (extensible Resend/SES).
- Mot de passe d'application Gmail (2FA requis), stocké chiffré mentalement comme secret : jamais affiché dans l'UI (champ password masqué, non renvoyé par `getSystemSettings`).
- Fallback WhatsApp conservé : une notification sans email part en WhatsApp et inversement.