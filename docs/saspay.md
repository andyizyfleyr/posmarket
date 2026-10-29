# SasPay — paiements d'abonnement

SasPay est une passerelle d'encaissement d'abonnements, au même titre que Kkiapay, FedaPay et FeexPay. Le vendeur est redirigé vers le checkout hébergé SasPay ; le choix du réseau et la saisie du numéro ou de la carte se font sur cette page. L'intégration ne réalise ni retraits ni paiements softpay directs.

## Mise en service

1. Appliquer `drizzle/0025_saspay_subscriptions.sql` à la base avant de déployer le code, par exemple avec `npm run db:migrate` ou `node scripts/apply-migration.mjs drizzle/0025_saspay_subscriptions.sql`. La migration ajoute les identifiants SasPay et les champs de rapprochement à `subscription_payments`, sans modifier les anciennes factures.
2. Configurer `APP_URL` dans l'environnement serveur avec l'URL publique HTTPS exacte de PosMarket, sans chemin ni barre finale, par exemple `https://votre-domaine.com`. `NEXT_PUBLIC_SITE_URL` est utilisé à défaut. Cette URL est nécessaire pour le retour du checkout.
3. Dans le tableau de bord SasPay, créer une clé d'API ayant le droit d'encaissement (`PAYIN` ou `BOTH`). Utiliser d'abord une clé `sk_test_...`, puis une clé `sk_live_...` en production. Le mode est déterminé par la clé, pas par une URL d'API différente.
4. Créer dans le tableau de bord SasPay un webhook vers `https://votre-domaine.com/api/saspay/webhook` et l'abonner au minimum à `transaction.success` et `webhook.test`. Copier son `signing_secret` lorsqu'il est affiché : il ne sera plus visible ensuite.
5. Dans **PAM → Paramètres système → Passerelle de paiement**, saisir la clé API et le secret du webhook, sélectionner **SasPay**, puis enregistrer. Les deux secrets sont nécessaires pour activer SasPay. Ils ne sont jamais réaffichés ; un champ laissé vide conserve la valeur existante. Ils sont stockés dans `system_settings` comme les autres paramètres de paiement : protéger l'accès à la base et aux sauvegardes.

En alternative à la saisie dans l'admin, on peut configurer `SASPAY_API_KEY` et `SASPAY_WEBHOOK_SECRET` dans l'environnement serveur. Une valeur saisie dans l'admin prévaut sur la variable correspondante. Aucun secret ne doit être commité, exposé dans le navigateur ou inclus dans les journaux.

Pour vérifier les variables d'environnement et tester **en lecture seule** les routes `/countries/` et `/pricing/my-rates/` :

```bash
node scripts/check-saspay.mjs
```

Cette commande ne lit pas les secrets enregistrés dans l'admin. Les anciens clients mobiles doivent être mis à jour pour utiliser le checkout SasPay.

## Confirmation et reprise

- Le checkout est créé côté serveur ; son identifiant est conservé avec la facture. Le montant transmis est une chaîne décimale en XOF.
- Le retour du navigateur ou de l'application ne prouve pas le paiement. Le serveur interroge le statut de la session puis vérifie sa transaction via `/payments/{id}/verify/`. Il exige `SUCCESS`, l'identifiant de transaction associé à la session, le montant demandé exact et la devise de la facture.
- L'approbation de la facture et l'activation du profil sont atomiques. Un index unique et une transition conditionnelle empêchent qu'un même paiement ou un webhook répété active plusieurs fois un abonnement.
- Les webhooks vérifient HMAC-SHA256 sur les octets bruts et l'horodatage, avec une tolérance de cinq minutes. SasPay n'inclut pas l'ID du checkout dans le webhook : les sessions payées récentes sont consultées pour trouver la transaction. Si elle n'est pas encore visible ou ne figure pas parmi les 100 premières sessions, le webhook répond 503 pour demander une nouvelle livraison ; le retour client, l'ouverture de la page abonnement ou le cron `/api/cron/subscriptions` revérifient également les factures dotées d'un identifiant de session. Le cron existant s'exécute une fois par jour et traite au plus 25 factures SasPay par passage ; vérifier qu'il est activé et que `CRON_SECRET` est configuré.
- Un échec de tentative ne ferme pas nécessairement la session SasPay : le client peut réessayer dans le même checkout. Une session expirée ou annulée est considérée comme non aboutie. Une erreur de vérification laisse la facture en attente.
- Pour le rapprochement comptable, `saspay_charged_amount` contient `debited_amount` (ce que le client a payé) et `saspay_net_amount` ce qui revient au marchand, lorsque ces valeurs sont fournies par SasPay. `saspay_fee_charge_mode` indique `ADD_ON` ou `DEDUCTED`. Le montant demandé de la facture n'est pas supposé égal au montant net.
- Ne pas changer de clé ou de compte SasPay tant que des paiements sont en attente : la nouvelle clé pourrait ne pas avoir accès aux anciennes sessions. Le checkout hébergé ne prend pas en charge `Idempotency-Key` ; l'application ne retente donc pas automatiquement sa création après un timeout. Si la réponse ou la sauvegarde de l'identifiant a été perdue, la facture reste en attente et un webhook récent peut la rattacher grâce aux métadonnées de la session. Si ce webhook est également manqué, il faut rapprocher manuellement cette facture dans le tableau de bord SasPay : le cron ne peut pas vérifier une facture dépourvue d'identifiant de session.

## Vérification avant production

Exécuter les tests automatisés locaux avec `npm run test:saspay` (réponses API simulées et PostgreSQL embarqué).

Avec une clé `sk_test_...`, tester un paiement réussi, un paiement en attente, une tentative échouée puis relancée, la fermeture du guichet sans retour automatique, le webhook `webhook.test`, une signature invalide ou trop ancienne et les livraisons répétées/concurrentes. Vérifier l'activation unique et le rapprochement des montants. Ensuite seulement, passer en `sk_live_...` et effectuer un premier paiement réel de faible montant.

**Statut de vérification :** les tests automatisés utilisent des réponses SasPay simulées et une base PostgreSQL locale de test. Aucun paiement sandbox ni webhook réel n'a été exécuté sans identifiants SasPay et URL publique configurée.
