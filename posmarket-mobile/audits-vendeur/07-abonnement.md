# Abonnement vendeur — spec mobile (parité web)

Référence web : `src/views/SubscriptionView.tsx`, `src/app/(app)/subscription/SubscriptionClientWrapper.tsx`, `src/app/(app)/subscription/page.tsx`, plans `src/constants.ts`, modale `src/components/TransactionResultModal.tsx`, hooks `src/hooks/useKkiapay.ts` / `useFedapay.ts` / `useFeexpay.ts`, actions `src/app/actions/subscription.ts`.
Rendu de référence : largeur mobile (<768 px) — classes sans variante `md:`.

## Données attendues (props + fournit par page.tsx et le layout (app)/layout.tsx : plan, userSubscription)

**SubscriptionView** (composant de page) reçoit : `currentSubscription: UserSubscription` (obligatoire) ; `userRole?: StaffRole` ; `onUpdateSubscription?` ; `onPay?` ; `notify?` (jamais fourni par le wrapper → toasts prévus par le code non affichés en pratique).

**SubscriptionClientWrapper** reçoit : `currentSubscription` ; `onUpdateSubscription` (→ `updateSubscriptionAction`) ; `onCreatePayment?` (→ `createSubscriptionPaymentAction`) ; `onConfirmPayment` (défaut `confirmKkiapayPaymentAction`) ; clés/envs `kkiapayPublicKey` / `kkiapayEnv`, `fedapayPublicKey` / `fedapayEnv`, `feexpayShopId` / `feexpayApiKey` / `feexpayEnv` ; `paymentProvider` (`kkiapay` défaut, `fedapay` ou `feexpay`) ; `userName`, `userEmail`, `userPhone` ; `paymentReturned?` ; `userRole?`. Il branche `onPay=handlePay` sur la vue.

**page.tsx fournit** :
- `currentSubscription` depuis `profiles` : `tier` = subscription_tier sinon `NONE` ; `duration` = subscription_duration sinon `monthly` ; `startDate` = subscription_start_date sinon ISO du jour ; `endDate` = subscription_end_date sinon ISO du jour ; `status` = subscription_status sinon `NONE`.
- `userRole` = `SUPER_ADMIN` si `profile.is_super_admin`, sinon `OWNER` (jamais `SELLER` sur cette route).
- Clés de paiement via `loadPaymentConfig()` (table `system_settings` ; provider défaut `kkiapay` ; envs défaut `sandbox`).
- `userName` = profiles.full_name ; `userEmail` = profiles.email sinon email session ; `userPhone` = profiles.phone.
- `paymentReturned` = `?returned=1` ou `?kkiapay=return` ou `?fedapay=return` ; si vrai, `syncKkiapaySubscriptions(user.id)` est appelé avant affichage.

**Layout `(app)/layout.tsx` fournit** : `userSubscription` (mêmes champs) ; `currentPlan = getSubscriptionPlan(tier) || SUBSCRIPTION_PLANS.PRO` ; `currentUserRole` (SUPER_ADMIN / OWNER / SELLER) ; `isSubscriptionValid` = tier payant + statut `ACTIVE` + endDate > maintenant.
- Sans abonnement valide, toutes les vues sauf « subscription » sont remplacées par l'écran « Abonnement Requis » (cadenas rouge, texte : abonnement obligatoire, bouton « Voir les offres ») : la page abonnement reste toujours accessible.
- Entrée mobile vers la page : badge du header (icône Clock 16, texte 9 px majuscules, titre « Gérer l'abonnement ») → route `/subscription`. Libellés mobiles : « S'abonner » (aucun plan), « -Expiré » (expiré ; le « - » est le préfixe mobile), « -{n}J » (jours restants ; « restants » est desktop seulement). Couleurs : orange (aucun), rouge (expiré), ambre (≤ 7 j), vert (actif).
- Menu profil : mention « Pas d'abonnement » / « Abonnement Actif » + ligne « Souscrire » / nom du plan.

**Types** : `UserSubscription { tier, duration, startDate, endDate, status }` ; tier `NONE|STARTER|PRO|ENTERPRISE|UNKNOWN` ; duration `monthly|quarterly|annual` ; status `ACTIVE|EXPIRED|CANCELLED|NONE`. `getSubscriptionPlan` renvoie undefined pour NONE/UNKNOWN/vide.

**Plans exacts (SUBSCRIPTION_PLANS)** :
- STARTER — nom « Starter », description « Pour bien commencer. » ; 12 000 FCFA/mois, 32 000/trimestre, 120 000/an ; 1 boutique, 50 produits ; boutique en ligne non, rapports avancés non, tickets personnalisés non ; icône Star, vert (texte `text-green-600`, pastille `bg-green-50`).
- PRO — nom « Pro », description « Pour les commerces en croissance. » ; 15 000/mois, 40 000/trimestre, 150 000/an ; 3 boutiques, 500 produits ; boutique en ligne oui, rapports avancés oui, tickets non ; icône Award, orange (`text-brand`, `bg-orange-50`) ; badge « Populaire ».
- ENTERPRISE — nom « Entreprise », description « Solution complète sans limites. » ; 20 000/mois, 55 000/trimestre, 200 000/an ; Illimité boutiques, Illimité produits ; boutique en ligne oui, rapports oui, tickets oui ; icône Zap, violet (`text-purple-600`, `bg-purple-50`).
- Économies calculées : STARTER -11 % / -17 % ; PRO -11 % / -17 % ; ENTERPRISE -8 % / -17 % (trimestre / an). Montants affichés : STARTER 4 000 / 24 000 FCFA ; PRO 5 000 / 30 000 ; ENTERPRISE 5 000 / 40 000.
- Montants formatés `formatCurrency` : milliers séparés par une espace, suffixe « FCFA » (ex. « 12 000 FCFA »). 0 ⇒ « Gratuit » (jamais atteint avec ces plans).

## Structure mobile (dans l'ordre)

Fond `bg-slate-50`, colonne centrée, padding 16 px, défilement vertical.

1. **Carte « Abonnement actuel »** (pleine largeur, largeur max 672 px, marge basse 24 px) : carte `rounded-2xl` bordée p-4, couleur selon l'état (priorité expiré > aucun plan actif > ≤ 7 j > normal) : expiré = fond rouge clair `bg-red-50` + bord rouge `border-red-100` ; sans plan actif = orange `bg-orange-50` + bord `border-orange-100` ; ≤ 7 jours = ambre `bg-amber-50` + bord `border-amber-100` ; sinon blanc `bg-white` + bord `border-slate-200`.
   - Pastille icône 40×40 `rounded-xl` : Info 20 (aucun plan), X 20 (expiré), Shield 20 (sinon) ; fonds teintés 100 et couleurs assorties (orange / rouge / ambre / vert).
   - Gauche : « Abonnement actuel » (12 px semibold slate-500) ; nom du plan (14 px bold ; rouge si expiré, sinon noir) — « Aucun » si aucun plan, suffixe « (Expiré) » si expiré.
   - Droite : si plan actif, « Expire dans » (10 px semibold majuscules slate-400) puis « {n}j » (18 px bold ; ambre si ≤ 7 j, sinon noir). Si aucun plan actif et non expiré, pastille « Aucun abonnement actif » (12 px semibold orange, fond orange clair, bord orange, radius lg, px-3 py-1.5). Si expiré, rien à droite.
   - `getDaysRemaining` = arrondi supérieur des jours restants, minimum 0.
2. **En-tête** centré : titre « Choisissez votre formule » (24 px bold noir) ; sous-titre « Des fonctionnalités adaptées à la taille de votre commerce. » (14 px slate-500).
   - Si rôle SELLER : carte orange dessous (mt-6, p-4, `rounded-2xl`, bord orange) avec icône Users 20 orange et texte « En tant que vendeur, l'abonnement est géré par le propriétaire de la boutique. » (12 px slate-600, aligné à gauche).
3. **Sélecteur de durée** (marge basse 32 px, centré) : pilule blanche p-1 `rounded-xl` bord slate-200, boutons dans l'ordre « Mensuel », « Trimestriel », « Annuel ». Bouton px-3 py-1.5, `rounded-lg`, 11 px semibold : actif = fond brand + texte blanc + ombre ; inactif = slate-500. Le bouton « Annuel » porte, tant que la durée choisie n'est pas annuelle, un badge rouge absolu en haut à droite « -17 % » (7 px, blanc, pilule) — valeur issue des économies de PRO.
4. **Grille des 3 plans** : 1 colonne, gap 16 px, largeur max 1024 px, marge basse 32 px. Carte blanche `rounded-2xl` p-4 en colonne ; si plan courant non expiré : anneau brand 2 px + grosse ombre teintée orange ; sinon bord slate-200 + petite ombre.
   - Badge centré débordant au-dessus de la carte (-12 px) : « Actuel » (fond brand, texte blanc) si plan courant non expiré ; sinon « Populaire » (fond noir `bg-slate-900`, texte blanc) pour PRO uniquement. 9 px, gras, majuscules, letter-spacing large, non coupé.
   - En-tête : pastille icône 18 px sur carré arrondi teinté (`p-2`) + nom du plan (16 px bold noir) ; description (12 px slate-400).
   - Prix (bloc mb-4) : montant 24 px bold noir + suffixe « /mois », « /3 mois » ou « /an » (12 px slate-400) ; libellés exacts selon la durée. Si durée ≠ mensuelle, ligne verte 10 px semibold « Vous économisez {montant} FCFA vs mensuel » (montant trimestriel ou annuel du plan).
   - Limites (2 lignes, coche verte 14) : « {1|3|Illimité} boutique(s) » (1 → « 1 boutique », 999 → « Illimité boutiques ») et « {50|500|Illimité} produit(s) » (999999 → « Illimité produits ») ; valeur en gras noir, libellé 12 px slate-600.
   - Comparateur de fonctionnalités = liste de 5 lignes par carte (pas de tableau séparé) : « Point de Vente (POS) » (toujours), « Gestion stocks & clients » (toujours), « Boutique en ligne » (PRO/ENTERPRISE), « Rapports avancés » (PRO/ENTERPRISE), « Tickets personnalisés » (ENTERPRISE seul). Coche verte 12 si incluse (texte 11 px slate-600), croix grise 12 slate-300 sinon (texte slate-300).
   - **Bouton** pleine largeur py-3 `rounded-xl` bold 12 px, désactivé si plan courant actif, si un chargement est en cours (toute carte), ou si rôle SELLER. Couleurs : plan courant = fond slate-100 + texte slate-400 ; SELLER = fond slate-50 + texte slate-300 ; rétrogradation (plan inférieur à l'actif) = fond slate-100 + texte slate-600 ; sinon fond brand + texte blanc.
   - Libellés exacts : « Choisir {nom} » (aucun plan actif), « Passer à {nom} » (plan actif différent), « Plan Actuel » (plan courant actif), « Réactiver » (plan courant expiré), « Contactez-nous » (durée trimestrielle ou annuelle), « Accès Restreint » (SELLER). Pendant le chargement : spinner blanc 14 px + « Activation... » (le libellé « Traitement... » du code n'est jamais affiché).
   - **Historique / paiements : AUCUN sur le web** — aucune liste de factures, aucun historique dans la page ni dans la modale. Ne rien inventer.
5. **Comportements de tap** :
   - Plan mensuel : lance le paiement (voir section Modales).
   - Plan trimestriel ou annuel : ouvre WhatsApp `https://wa.me/?text=...` avec le message exact « Bonjour l'équipe PosMarket, je souhaite souscrire à la formule {nom} ({Trimestriel|Annuel}) au tarif de {prix} FCFA. » ; aucune modale. Le code prévoit aussi un toast « Formule {nom} ({durée}) : redirection vers le support commercial... » (titre « Contact ») mais `notify` n'est jamais fourni par le wrapper → non affiché.
   - Plan courant actif : tap sans effet (retour anticipé).
   - Erreurs du flux mensuel : gérées par modale (pas de toast).

## Modales / feuilles / menus (paiement : étapes exactes, opérateurs, champs, messages)

Une seule modale : **TransactionResultModal** (pas de bottom sheet ni de menu sur cette page). Fond noir 65 % + flou, carte blanche max 400 px `rounded-3xl`, barre dégradée 8 px en haut (vert succès / rouge erreur / ambre annulé / bleu chargement), bouton fermer X 18 px en haut à droite sauf en chargement, contenu p-6 centré.

Étapes du flux mensuel (handlePay) :
1. Mémorise la tentative (tier + durée), appelle `createSubscriptionPaymentAction(tier, duration)`.
2. Échec : modale erreur « Initialisation Échouée » + message serveur ou « Impossible de créer la facture de paiement. ».
3. Données incomplètes (transactionId ou montant manquant) : modale « Facture Invalide » + « Les données de transaction sont incomplètes. ».
4. Vérification de configuration du provider : modale « Configuration Manquante » + « Le paiement Kkiapay n'est pas configuré par l'administrateur. » / « Le paiement FedaPay n'est pas configuré par l'administrateur. » / « Le paiement FeexPay n'est pas configuré par l'administrateur. ».
5. Module paiement non chargé : modale « Module en Chargement » + « Le module de paiement Kkiapay est encore en cours de chargement. » / « Le module de paiement FedaPay est encore en cours de chargement. Veuillez patienter un instant et réessayer. » / équivalent FeexPay.
6. Ouverture du guichet (opérateurs Mobile Money selon provider) :
   - Kkiapay : montant, clé publique, sandbox = env, partnerId = transactionId, données `{tier, duration}`, nom / email / téléphone ; méthode `momo`, pays BJ, thème orange `#f56b2a`, position centre.
   - FedaPay : clé publique, montant entier, description « Abonnement {TIER} - {duration} (ref: {transactionId}) », environnement sandbox/live, client = email + prénom/nom dérivés de userName (défauts client@posmarket.com / Client / PosMarket).
   - FeexPay : shopId, token (= clé API), montant, mode LIVE/SANDBOX, description « Abonnement {TIER} - {duration} », callbackInfo = transactionId.
7. Retour succès du guichet : extraction de la référence ; si vide, modale « Référence Introuvable » + « Impossible de récupérer l'identifiant de transaction Kkiapay/FedaPay/FeexPay. » puis `onConfirmPayment(transactionId, référence)`.
   - Confirmation OK : modale succès « Paiement Réussi ! » + « Votre abonnement {TIER} ({Annuel|Trimestriel|Mensuel}) est désormais actif. » (Kkiapay : « ... est activé. ») + montant + devise FCFA + pastille orange « Formule {TIER} • {durée} » ; rafraîchit la page.
   - Confirmation refusée : modale erreur « Paiement Non Confirmé » + message serveur ou « Le paiement n'a pas pu être validé par Kkiapay/FedaPay/FeexPay. » ; rafraîchit.
   - Exception : modale « Erreur de Confirmation » + « Une erreur est survenue lors de la validation de votre paiement. » (Kkiapay : « ... lors de la confirmation du paiement Kkiapay. »).
8. Échec du guichet : Kkiapay → « Paiement Interrompu » + « La session de paiement Kkiapay a été annulée ou n'a pas abouti. » ; FedaPay/FeexPay fermeture utilisateur → « Paiement Annulé » + « Vous avez fermé le guichet de paiement sans finaliser la transaction. » ; autres échecs → « Paiement Non Abouti » + message opérateur ou « La transaction a été refusée ou interrompue. ».
9. Retour de navigation après paiement (`?returned=1`, `?kkiapay=return`, `?fedapay=return`) : modale succès « Paiement Confirmé ! » + « Votre paiement a été reçu et votre abonnement est maintenant actif. », puis nettoyage de l'URL (sans vérification locale du statut).
10. Contenu de la modale : pastille 80 px selon l'état (succès rond vert + ondes + particules ; erreur rond rouge + X ; annulé rond ambre + triangle ; chargement rond bleu tournant), titre 20 px bold coloré (vert/rouge/ambre/bleu), message 12 px slate-500, encadré gris si montant > 0 (libellé « Montant Total » 10 px majuscules, montant 24 px sans « FCFA », devise « FCFA » 12 px bold, pastille formule orange si tier). Boutons : succès → « Accéder à mon espace » (fond brand, flèche) ; erreur/annulé → « Réessayer le paiement » (fond brand, icône refresh) si une tentative existe, sinon lien « Aide WhatsApp » (icône verte) avec l'URL exacte `https://wa.me/?text=Bonjour%20PosMarket%2C%20j%27ai%20besoin%20d%27assistance%20pour%20mon%20paiement%20d%27abonnement.` et bouton « Fermer » (gris).
11. « Fermer » déclenche un rafraîchissement ; « Réessayer » relance handlePay avec la dernière tentative mémorisée.
12. La modale web ne sert jamais d'état « chargement » (statut non utilisé par ce flux).

## Actions & données utilisées (imports @/app/actions/*, fetch, hooks paiement, webhooks)

- `src/app/actions/subscription.ts` : `updateSubscriptionAction(tier, duration)` (activation directe + notification ABONNEMENT_ACTIVE + revalidation) ; `createSubscriptionPaymentAction(tier, duration)` (contrôle provider configuré ; insertion d'une facture PENDING dans la table `subscription_payments` avec transactionId UUID et montant `subscriptionAmount` ; renvoie `{ success, transactionId, amount }`) ; `confirmKkiapayPaymentAction(transactionId, txId)` (vérifie la transaction Kkiapay, montant exact, passe la facture APPROVED, active l'abonnement) ; `confirmFedapayPaymentAction` et `confirmFeexpayPaymentAction` (mêmes étapes, tolérance 1 FCFA sur le montant, notification ABONNEMENT_ACTIVE).
- Montants : `subscriptionAmount(tier, duration)` = prix mensuel/trimestriel/annuel du plan. Activation : `activateSubscription` fixe startDate = maintenant, endDate = +1 mois / +3 mois / +1 an, statut `ACTIVE` sur `profiles`.
- `src/lib/paymentConfig.ts` : `loadPaymentConfig()` lit `system_settings` (clés `payment_provider`, clés/envs Kkiapay/FedaPay/FeexPay) et initialise les clients serveur.
- `src/lib/subscriptionSync.ts` : `syncKkiapaySubscriptions(userId)` appelé au retour de paiement.
- Hooks client (widgets JS navigateur, non utilisables tels quels en React Native) : `useKkiapay` charge `https://cdn.kkiapay.me/k.js` ; `useFedapay` charge `https://cdn.fedapay.com/checkout.js?v=1.1.7` ; `useFeexpay` charge `https://api-v2.feexpay.me/feexpay-javascript-sdk/index.js`. `ready` + `openWidget` uniquement.
- Webhooks serveur (hors app mobile, pour information) : `/api/kkiapay/webhook`, `/api/fedapay/webhook`, `/api/feexpay/webhook`, cron `/api/cron/subscriptions`. Aucun `fetch` direct dans la page abonnement ; tout passe par les server actions.

## Exclusions desktop (md:/lg: seulement)

À EXCLURE du rendu mobile (uniquement présentes avec `md:`) :
- SubscriptionView : padding page `md:p-12` ; marges `md:mb-10`, `md:mb-12`, `md:mb-3` ; rayons `md:rounded-3xl` (carte statut, cartes de plans) ; paddings `md:p-6`, `md:p-5` (carte vendeur) ; tailles `md:w-12 md:h-12` (pastille statut), `md:text-sm`, `md:text-lg`, `md:text-2xl`, `md:text-4xl` (titre), `md:text-base` (sous-titre), `md:text-xs`, `md:text-[9px]`, `md:text-[10px]`, `md:text-[11px]`, `md:text-[9px]` (badge -17 %), `md:text-3xl` (prix) ; sélecteur de durée `md:px-5 md:py-2` ; grille `md:grid-cols-3` et `md:gap-6`.
- TransactionResultModal : `md:p-8` (contenu), `md:text-2xl` (titre), `md:text-sm` (message), `md:text-3xl` (montant).
- Navbar (entrée abonnement) : `md:px-4 md:py-2`, `md:text-[11px]`, `hidden md:inline` (« restants »). À INCLURE au contraire les variantes `md:hidden` (préfixe « - » devant « Expiré » / « {n}J »).
- Effets uniquement pointeur (hover) à ignorer : survol des cartes (`hover:shadow-md`, `hover:-translate-y-1`), des boutons (`hover:bg-[#d55a20]`, `hover:bg-slate-200`, `hover:shadow-lg`, `hover:-translate-y-0.5`), bouton durée (`hover:bg-slate-50`) — conserver seulement les états actifs/désactivés.

## Points ambigus / à vérifier

1. **Historique de paiements** : absent du web (aucune UI), alors que la table `subscription_payments` existe — la spec mobile ne doit pas en créer.
2. **Widgets de paiement** : SDK JS navigateur (Kkiapay/FedaPay/FeexPay) inutilisables en React Native ; prévoir SDK natif, WebView ou URL de paiement serveur. `createSubscriptionPaymentAction` ne renvoie que `transactionId` + `amount` (le type de prop `onCreatePayment` déclare `paymentUrl`/`code` mais ils ne sont jamais produits).
3. `onPay` est toujours fourni par le wrapper : la branche `onUpdateSubscription` (activation directe + toast « Abonnement {nom} activé avec succès ! ») et `notify` sont morts sur cette route ; ne pas les porter en priorité.
4. Le libellé « Traitement... » n'est jamais affiché (le bouton affiche « Activation... ») ; le spinner disparaît dès l'ouverture du guichet (handlePay résout avant le paiement réel) — comportement web à reproduire ou à améliorer volontairement.
5. Trimestriel/annuel non payables en ligne : redirection WhatsApp support (`wa.me` sans numéro, le contact par défaut est choisi par l'OS).
6. Rôle SELLER jamais transmis par `page.tsx` (SUPER_ADMIN/OWNER uniquement) : « Accès Restreint » et la carte « abonnement géré par le propriétaire » sont quasi inatteignables ; vérifier le besoin réel côté mobile (personnel vendeur).
7. À `NONE`, l'`endDate` par défaut est la date du jour → la carte passe souvent en mode rouge « (Expiré) » plutôt qu'en orange « Aucun abonnement actif » ; reproduire à l'identique ou corriger.
8. La modale de retour de paiement affiche un succès sans vérifier le statut réel (la validation serveur passe par les webhooks/cron).
9. Comparaison des montants Kkiapay au centime près, FedaPay/FeexPay à ±1 FCFA — attention aux arrondis côté natif.
10. Le badge « -17 % » du sélecteur est calculé sur PRO mais vaut -17 % pour les 3 plans ; le badge « Populaire » disparaît sur le plan courant (`!isCurrent`).
11. `userAvatarUrl` est passé par page.tsx mais non utilisé par le wrapper (aucun rendu) — sans effet.