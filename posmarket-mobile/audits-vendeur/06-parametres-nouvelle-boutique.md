# Paramètres & Nouvelle boutique — spec mobile (parité web)

> Référence = rendu web à largeur mobile (<768 px). Règle : ne garder que les classes sans variante `md:`/`lg:` (et `sm:`).
> Sources : `src/views/SettingsView.tsx` (786 lignes), `src/app/(app)/settings/page.tsx`, `src/components/NoStoreFound.tsx`, `src/app/(app)/new-store/page.tsx`.
> Jetons de couleur (`src/app/globals.css`) : brand #f56b2a, brand-hover #e55a1b, brand-soft #fff3ed, brand-tint #fde4d7, ink #002f34, line #eef0f2.

## Page /settings

### Données attendues (props + fournit par src/app/(app)/settings/page.tsx)

Props de `SettingsView` (interface `SettingsViewProps`) :
- `storeSettings: StoreSettings` — requis.
- `staff: Staff[]` — requis.
- `coupons?: Coupon[]` — défaut `[]`.
- `permissions: StaffPermissions` — seul usage : masquer l'onglet Équipe (`canManageStaff`).
- `userRole: StaffRole` — déclaré mais NON déstructuré : inutilisé.
- `notify?: (message, type, title?) => void` — IMPORTANT : la page serveur ne le passe pas, donc tous les toasts de cet écran sont des no-op côté web. Seuls retours visibles : « Prêt ! » sur le bouton Enregistrer et l'état des boutons.
- `stores: StoreData[]` — sert au sélecteur « Attribuer à la boutique » et au nom de boutique affiché sur chaque membre.
- `currentStoreId: string` — peut être `''` si aucune boutique.
- `currentUserId?: string`.
- `userName?: string`, `userEmail?: string`.
- `userAvatarUrl?: string | null` — déclaré mais inutilisé (jamais déstructuré).

Fourni par `src/app/(app)/settings/page.tsx` (`dynamic = 'force-dynamic'`) :
- Retourne `null` si pas de session.
- `storeId = getEffectiveStoreId(supabase, session)` : cookie `currentStoreId` vérifié (propriétaire ou staff), sinon 1re boutique possédée, sinon 1re boutique où l'utilisateur est staff, sinon `null`.
- `stores` : lignes `stores` où `user_id = session.user.id`, mappées `{ id, slug, settings, user_id, name }`.
- `currentStore` : ligne `stores` de `storeId` (name, email, phone, address, ninea, description, settings).
- `mergedSettings` : `name` (défaut « Ma Boutique »), `email` (défaut e-mail de session), `phone`, `address`, `ninea`, `logo` (settings.logo), `currency` défaut 'XOF', `language` défaut 'fr', `description`, puis spread de `settings` (conserve country, wholesaleEnabled, wholesaleMinOrderAmount, businessType…).
- `staff` : lignes `store_staff` de la boutique (`userId`/`storeId` normalisés) + jointure `profiles` (`id, email, full_name`) → `{ ...row, email, fullName }`.
- `coupons` : lignes `coupons` de la boutique.
- `permissions`/`role` : `getPermissionsForUser(supabase, user.id, storeId)` ; défauts `FULL_PERMISSIONS`/'OWNER' si pas de boutique.
- `userName` = `profile.full_name` ou préfixe e-mail ou `''` ; `userEmail` = e-mail de session.

### Structure mobile (dans l'ordre) : sections (infos boutique, personnel/équipe, compartiments/rôles, danger zone…), champs exacts (labels, placeholders), uploads (logo), tailles/couleurs, textes EXACTS, boutons, validations, modales (contenu exact), états.

Cadre général :
- Conteneur : colonne, plein écran, fond gray-50/30, padding 12 px (p-3).
- Bloc en-tête (colonne, gap 12 px, mb 16 px) :
  - Titre « Réglages » 18 px bold gris-900 tracking-tight, non coupé.
  - Sous-titre « Gérez vos préférences. » 10 px gray-500 tronqué.
  - Bouton pleine ligne à droite : 16 px haut de contenu, px-4 py-2, rounded-lg (8 px), texte 10 px bold blanc, shadow-lg, fond brand, actif → scale 0.95.
    - Repos : icône Save 16 + « Enregistrer ».
    - En cours : spinner Loader2 16 + « Traitement... », opacité 70 %, bouton désactivé.
    - Succès (2,5 s) : icône ShieldCheck 16 + « Prêt ! », fond green-500, ombre vert clair.
- Barre d'onglets : ligne horizontale scrollable (gap 6 px, pb 12 px, débord -12 px + px-12, scrollbar masquée). Onglets dans l'ordre :
  1. « Boutique » (icône Store 18).
  2. « Profil » (icône User 18).
  3. « Équipe » (icône Users 18) — affiché uniquement si `permissions.canManageStaff`.
  4. « Promos » (icône Tag 18).
  - Bouton : icône + libellé 10 px bold, px-3 py-2, rounded-lg, nowrap. Actif = fond blanc + texte brand + shadow-md + border gray-100. Inactif = gray-500.
  - Onglet actif lu depuis l'URL `?tab=store|user|staff|promos` (défaut `store`) ; changement = `router.push('?tab=...')`.
- Carte contenu : fond blanc, rounded-3xl (24 px), border gray-100, shadow-sm, padding 14 px, scroll vertical ; animation fade-in + slide-in-from-right-4 (300 ms) à chaque changement d'onglet.

Onglet « Boutique » (espace vertical 24 px) :
- En-tête de section « Informations de la Boutique » : pastille brand p-1.5 rounded-lg, icône Store 14 blanche ; titre 10 px bold majuscules tracking-widest ; mb 12 px.
- Logo boutiques, centré :
  - Zone 80×80 px (w-20 h-20), rounded-2xl (16 px), fond gray-50, bordure 2 px pointillée gray-200. Contenu : logo (image `object-cover`) ou icône Store 32 gris-300.
  - Badge appareil photo 28×28 px (w-7 h-7) fond brand, décalé -4 px en bas à droite, icône Camera 14 blanche.
  - Input fichier caché `accept="image/*"`.
  - Légende « Logo de la boutique » 9 px gray-400 semibold, mt 8 px.
- Grille 1 colonne, gap 16 px (l'ordre exact) :
  1. Bouton/zone logo (ci-dessus).
  2. Label « Nom de la Boutique » (9 px bold gray-400 majuscules tracking-widest, mb 4 px). Input pl-10 pr-4 py-2.5, fond gray-50, border gray-100, rounded-xl (12 px), texte 11 px semibold ; icône Building 14 à 14 px de la gauche.
  3. Label « Email de Contact ». Même gabarit ; icône Mail 14.
  4. Label « Numéro WhatsApp (Commande) ». Composant `PhoneInput` (voir plus bas).
  5. Label « Pays ». Composant `CountrySelect` (voir plus bas).
  6. Label « Description de la boutique ». Icône FileText 14 en haut à gauche (top 12 px). Textarea pl-10 pr-4 py-3, min-h 100 px, resize désactivé, 11 px, placeholder EXACT : « Décrivez votre univers (lettres, espaces et points uniquement, max 250 car.)... ». `maxLength=250`. Filtre de saisie en direct : tout caractère hors `[a-zA-ZÀ-ÿ\s\.]` est supprimé (accents conservés). Compteur en bas à droite « {n} / 250 » 8 px bold gray-300 majuscules.
     - Note sous le champ : icône Info 10 + « Chiffres, liens et codes interdits (Lettres uniquement) » 8 px gris-400 semibold italique.
- Section « Vente en Gros & Commandes Groupées (B2B) », séparée par un filet supérieur (pt 24 px) :
  - En-tête de section identique, icône Zap.
  - Carte interrupteur : p-4, fond orange-50/60, rounded-2xl (16 px), border orange-100, ligne justify-between.
    - Pastille 40×40 rounded-xl fond brand/20, icône Zap 20 (remplie).
    - Titre « Activer les commandes de gros (B2B) » 12 px bold.
    - Description « Permet d'afficher vos offres dégressives et le bouton de commande rapide » 10 px gris-500.
    - Switch : 44×24 px (w-11 h-6), piste gray-200 → brand si actif, bouton blanc 20 px, transition.
  - Si activé, carte p-4, fond gray-50, rounded-2xl, border gray-100, espace 8 px :
    - Label « Montant Minimum de Commande Grossiste (F CFA) » 10 px bold gray-700 majuscules tracking-wider.
    - Input number, min 0, step 1000, pl-4 pr-16 py-2.5, fond blanc, border gray-200, rounded-xl, 12 px semibold, placeholder « Ex: 50000 (Laissez vide ou 0 pour aucun minimum) ». Suffixe « F CFA » 12 px semibold gray-400 (right 16 px). Valeur vide = `undefined`.
    - Aide « Les acheteurs devront atteindre ce montant d'achat dans votre boutique pour passer une commande avec tarifs grossistes. » 9 px gris-500.

Onglet « Profil » (espace vertical 32 px) :
- Carte bannière : p-6, dégradé brand → #ff8c52, rounded-[32px], shadow-2xl shadow-orange-100, colonne centrée, gap 24 px, décor : 2 cercles flous blanc/10 et noir/10.
  - Avatar 112×112 px (w-28 h-28), rounded-[32px], bordure 4 px blanche/30, overflow caché. Source : photo choisie, sinon `https://api.dicebear.com/7.x/avataaars/svg?seed={userEmail}`.
  - Bouton appareil photo en bas à droite (-8 px) : p-2.5, fond blanc, texte brand, rounded-2xl, ombre ; icône Camera 18 ; input fichier caché `accept="image/*"`.
  - Nom « {profileName || 'Gérant'} » 24 px bold blanc, tracking-tight, centré.
  - Ligne e-mail centrée : icône Mail 14 + `{userEmail}` 12 px blanc/80.
- Bloc largeur max 2xl centré (espace vertical 32 px) :
  - En-tête « Identité Personnelle » : pastille p-2 fond orange-50 rounded-xl + icône User 20 brand ; titre 12 px bold majuscules tracking-widest.
  - Carte : fond gray-50/50, p-6, rounded-[32px], border gray-100, espace vertical 32 px.
    - Label « Nom Complet » 10 px bold gray-400 majuscules, ml 4 px.
    - Input texte pl-12 pr-4 py-4, fond blanc, border gray-100, rounded-2xl, 14 px semibold, placeholder « Votre nom », icône User 20 à gauche (brand au focus).
    - Bouton pleine largeur « Sauvegarder les modifications » : py-4 (18 px), fond brand, rounded-2xl, 14 px bold blanc, ombre orange ; icône Save 18. En cours : spinner 18 + « Mise à jour... », désactivé, opacité 50.

Onglet « Équipe » (visible si `permissions.canManageStaff`) :
- Ligne d'en-tête : en-tête de section « Gestion de l'Équipe » (icône Users) à gauche, bouton « Ajouter un membre » à droite (icône Plus 14 + libellé 10 px bold, px-3 py-2, rounded-lg, fond brand, shadow-lg).
- Liste : grille 1 colonne, gap 12 px.
  - État vide : bloc pleine largeur py-12 centré, texte gris-400 semibold, bordure 2 px pointillée gray-100, rounded-3xl : « Aucun membre d'équipe enregistré. »
  - Carte membre : p-3.5, fond gray-50, border gray-100, rounded-xl (12 px), position relative.
    - Bouton corbeille en haut à droite (top-2.5 right-2.5) : p-1.5, icône Trash2 12, rouge-400 ; opacité 60 % en permanence sur mobile (opacité 0 réservée au desktop, au survol). Libellé accessible absent.
    - Vignette 40×40 rounded-xl, fond blanc, border gray-100, icône User 20 brand.
    - Nom 12 px bold gris-900 truncate, pr-6 : `fullName || email || userId.slice(0,8)`.
    - Badge rôle : 8 px bold, px-1.5 py-0.5, rounded-full. OWNER = fond purple-100 / texte purple-600. Sinon (SELLER) = fond orange-100 / texte brand.
    - Ligne boutique : icône Store 8 + nom recherché dans `stores` par `member.storeId`, sinon « Boutique » ; 9 px gris-400 semibold tronqué.
- Aucune zone de danger, aucune action de suppression de boutique dans cet onglet.

Onglet « Promos » :
- En-tête de section « Campagnes Promotionnelles » (icône Tag).
- Paragraphe « Créez des codes promo uniques pour fidéliser vos clients et booster vos ventes en ligne. » 12 px gris-500, mb 24 px.
- Carte « Nouveau Code » : fond gray-50, rounded-2xl, p-4, border gray-100, mb 32 px. Titre 12 px bold majuscules, icône Plus 16 brand.
  - Colonne, gap 12 px :
    - Input code pleine largeur : px-4 py-2.5, fond blanc, border gray-100, rounded-xl, 12 px bold, uppercase, placeholder « Code (ex: BIENVENUE20) ».
    - Ligne remise : input number pleine largeur (min 1, max 100, défaut 10), px-4 py-2.5, fond blanc, rounded-xl, 12 px bold ; symbole « % » 12 px bold gris-400 (right 32 px).
    - Bouton « Ajouter » : px-6 py-2.5, fond brand, rounded-xl, 12 px bold blanc, ombre ; désactivé si code vide (trim) ou chargement. En cours : spinner 16 + « Action... ».
- Liste : espace 12 px.
  - Vide : py-12 centré, gris-400, bordure 2 px pointillée gray-50, rounded-3xl ; icône Tag 48 opacité 10 % ; texte « Aucune promotion active actuellement. » 14 px semibold italique.
  - Carte promo : p-3.5, fond blanc, rounded-xl, border gray-100, shadow-sm, ligne justify-between.
    - Bouton case à cocher (bascule) : CheckSquare 22 brand si active ; Square 22 gris-300 sinon.
    - Code 12 px bold majuscules tracking-tighter.
    - Badge « -{discount_pct}% » 9 px bold, fond orange-50, texte brand, rounded-lg, px-1.5 py-0.5.
    - Mention « Valide en ligne » 10 px gris-400.
    - Bouton corbeille : p-2, icône Trash2 18, gris-300 (rouge au survol).
- Encadré conseil (mt 32 px) : p-4, fond orange-50/50, rounded-2xl, border orange-100/50, ligne gap 12 px. Icône ShieldCheck 18 brand. Texte brand 10 px : « Conseil : Les codes promo sont sensibles à la casse. Vos clients verront ces remises s'appliquer automatiquement s'ils saisissent le code correspondant dans leur panier. » (« Conseil : » en gras).

Modale « Nouvel Employé » (ouverte par « Ajouter un membre ») :
- Voile : plein écran, z-index 110, fond slate-900/40, flou d'arrière-plan, fade-in 300 ms. Pas de fermeture au clic sur le voile (aucun handler) ; fermeture par X ou Annuler uniquement.
- Panneau centré : fond blanc, rounded-[32px], pleine largeur, max 512 px (max-w-lg), max-h 95 vh, colonne, ombre forte.
- En-tête (p-6, border-b gray-100, fond gray-50/50) : titre « Nouvel Employé » 20 px bold ; sous-titre « Ajoutez un membre de votre équipe à cette boutique. » 12 px gris-500 ; bouton X 24 (p-2, gris-400).
- Corps formulaire (p-6, espace vertical 20 px) :
  1. Label « Email de l'employé » 10 px bold gray-400 majuscules. Champ e-mail `required type=email`, pl-12 pr-4 py-3.5, fond gray-50, border gray-100, rounded-2xl, 14 px semibold, placeholder « exemple@boutique.com », icône Mail 18 à gauche (brand au focus). Aide « L'employé doit avoir déjà créé son compte (connexion par lien email). » 11 px gris-400.
  2. Bloc « Attribuer à la boutique » — uniquement si `stores.length > 1`. Select pl-12 pr-4 py-3.5, rounded-2xl, 14 px bold, icône Store 18, icône ChevronRight 18 pivotée 90° à droite ; options = `stores.map(s => s.settings.name)` ; valeur initiale `currentStoreId`.
  3. Bloc « Niveau d'accès (Rôle) » : label 10 px bold gray-400 majuscules mb 12 px. Carte p-4, fond orange-50, bordure 2 px brand, rounded-2xl, ligne justify-between : « VENDEUR (SELLER) » 14 px bold brand + « Accès au POS, commandes et inventaire. » 10 px brand/70 ; icône ShieldCheck 24 brand. Le rôle est figé : aucun sélecteur, `newStaffRole` n'a pas de setter.
- Pied (pt 24 px, deux boutons flex-grow, gap 12 px) : « Annuler » (py-4, bordure 2 px gray-100, rounded-2xl, 14 px bold gris-400) et « Valider » (py-4, fond brand, rounded-2xl, 14 px bold blanc, icône Save 20) ; pendant l'envoi : spinner 20 + « Création... » et bouton désactivé.

Modale de confirmation (suppression d'un membre, composant `ConfirmationModal`) :
- Voile slate-900/60 + flou, panneau blanc rounded-3xl, max 448 px, p-6 ; fermeture au clic sur le voile et touche Échap ; focus initial sur le bouton confirmer.
- Icône Trash2 24 rouge dans pastille rose (type danger) ; bouton X 18 en haut à droite.
- Titre 18 px bold : « Supprimer ce membre ».
- Message 14 px gris-600 : « Êtes-vous sûr de vouloir supprimer {nom} de l'équipe ? Cette action est irréversible. » Le nom n'est jamais transmis par la liste (appel `handleDeleteStaffLocal(member.id)` sans nom) : le texte réel est donc « Êtes-vous sûr de vouloir supprimer ce membre de l'équipe ? Cette action est irréversible. »
- Boutons à droite : « Annuler » (gris) et « Supprimer » (fond rose-600) ; spinner 16 dans le bouton pendant la suppression.

Composants de formulaire importés (rendu mobile) :
- `PhoneInput` (« Numéro WhatsApp (Commande) ») :
  - Contrôle 52 px de haut, fond gray-50/70, bordure arrondie rounded-xl, focus ring brand/15.
  - Bouton pays à gauche (pl-3.5) : drapeau + ChevronDown 14 (pivote à l'ouverture) ; attribut aria « Choisir le pays ».
  - Champ `type=tel` flex-1 px-3, 15 px semibold, placeholder par défaut « Numéro de téléphone » (aucun placeholder spécifique depuis cet écran).
  - Tap pays → modale « Pays et indicatif », sous-titre « Sélectionnez le pays du numéro », icône Globe 18 : champ « Rechercher pays ou indicatif... », liste des pays (drapeau, nom, indicatif en police mono, coche si sélectionné), état vide « Aucun pays trouvé ». 9 pays : Bénin +229 (défaut), Togo +228, Côte d'Ivoire +225, Sénégal +221, Cameroun +237, Mali +223, Niger +227, Ghana +233, Nigeria +234.
  - Valeur stockée : numéro au format E.164 ; la vue reçoit le numéro national (indicatif retiré) dans le champ. Saisie commençant par « + » ou « 00 » = re-parse complet avec détection du pays.
  - Erreur éventuelle : bordure rouge + texte rouge 10 px.
- `CountrySelect` (« Pays ») :
  - Bouton pleine largeur px-3.5 py-3, fond gray-50/70, rounded-2xl (16 px), 14 px semibold ; drapeau + nom du pays, sinon placeholder « Sélectionner un pays » ; ChevronDown 15 (pivote).
  - Liste déroulante sous le bouton (carte blanche rounded-2xl, shadow-xl) : champ « Rechercher un pays... », liste scrollable max-h 240 px (drapeau, nom, coche), état vide « Aucun pays trouvé » ; ferme au clic extérieur.
  - Valeur = nom du pays (ex. « Bénin »).

États internes :
- `localSettings` (initialisé depuis `storeSettings`, complété par adresse/description de `currentStoreData`, resynchronisé à chaque changement de `storeSettings`).
- `isSaving`, `saveFeedback` (2,5 s), `isStaffModalOpen`, `isSubmittingStaff`, `newStaffEmail`, `profileName`, `profilePhoto`, `isUpdatingProfile`, `newStaffRole` figé 'SELLER', `selectedStoreId`, `localCoupons` (resynchronisé), `newCouponCode`, `newCouponDiscount` (10), `loadingCoupons`, `staffToDelete`, `isDeletingStaff`.
- Sous-composants définis : `SettingItem` (icône + titre + description + badge + chevron, ligne 12 px de haut, icône 16, titre 11 px bold, description 9 px gris-400) N'EST PAS utilisé dans le rendu : ne pas le porter. `SectionHeader` est utilisé 4 fois (pastille brand p-1.5 rounded-lg, icône 14, titre 10 px bold majuscules).

Validations :
- Enregistrement : si `currentStoreId` → `updateStoreSettingsAction(currentStoreId, localSettings)` ; sinon si `currentUserId` → `createStoreAction(localSettings, currentUserId)` (refresh immédiat). Succès → « Prêt ! » 2,5 s. Échec → toast (no-op côté web).
- Description : filtre regex + 250 caractères max.
- Promo : code obligatoire (forcé en majuscules), remise 1 à 100 (défaut 10).
- Employé : e-mail obligatoire (toast « L'email de l'employé est requis » côté JS + `required` natif) ; code couleur : aucun autre champ.
- Champ Nom boutique / e-mail boutique : aucune validation de format.

### Actions & données utilisées (imports @/app/actions/*, supabase, fetch)

- Import principal : `updateStoreSettingsAction`, `createStoreAction`, `saveCouponAction`, `deleteCouponAction`, `addStaffAction`, `deleteStaffAction`, `updateProfileAction` depuis `@/app/actions/settings`.
- `updateStoreSettingsAction(storeId, settings)` : contrôle `requireStoreAccess` ; si `settings.logo` est un data-URI il est envoyé sur R2 (`uploadDataUriToR2(..., 'logos')`) ; slug régénéré (`[^a-z0-9]+` → tirets) ; écrit `name, slug, email, phone, address, ninea, settings` ; `revalidatePath('/settings')` + tag 'marketplace' ; renvoie `{ success }` ou `{ success: false, error }`.
- `createStoreAction(settings, userId)` : `requireSelfOrAdmin` ; insère une ligne `stores` (userId, name, slug, settings, email, phone, address, ninea) ; renvoie `{ success, store }`.
- `updateProfileAction(userId, { fullName, avatarUrl })` (alias de `updateProfileSettingsAction`) : met à jour `profiles.fullName` ; avatar data-URI envoyé sur R2 ('avatars'), URL http acceptée telle quelle, chaîne vide = `null` ; revalide `/settings` et `/mon-compte`.
- `saveCouponAction({ code, discountPct, active }, storeId)` : insère un coupon (code en majuscules, expiresAt null) ; renvoie `{ success, coupon }`.
- `deleteCouponAction(id)` : vérifie la propriété via la ligne coupon puis supprime.
- `addStaffAction({ email, role }, storeId)` : refuse si aucun profil (« Aucun compte n'est associé à cet email. L'employé doit d'abord créer son compte avant d'être ajouté à votre équipe. ») ou si compte acheteur (« Cet email est associé à un compte acheteur. L'employé doit disposer d'un compte vendeur pour accéder au POS. ») ; insère `store_staff` (rôle défaut SELLER, conflit ignoré).
- `deleteStaffAction(id)` : vérifie la propriété puis supprime la ligne `store_staff`.
- Appel Supabase direct depuis la vue : `supabase.from('coupons').update({ active }).eq('id', id)` pour la bascule d'un code promo, avec mise à jour optimiste puis rollback local si erreur. C'est la seule écriture qui ne passe pas par une action serveur.
- Aucun `fetch` HTTP direct. Rechargement des données par `router.refresh()` après chaque mutation.
- Upload d'images : `optimizeImage` (browser-image-compression : max 1600 px, WebP, qualité 0.92, plafond 2,5 Mo) puis `fileToBase64` (FileReader → data-URI) ; le base64 reste dans l'état local jusqu'à l'enregistrement.
- Types : `StoreSettings` (businessType?, name, email, phone, address, country?, ninea, logo?, currency?, language?, description?, wholesaleEnabled?, wholesaleMinOrderAmount?) ; `Staff` { id, userId, storeId, role } ; `StaffPermissions` (7 booléens : canManageInventory, canManageCustomers, canManageOrders, canViewReports, canManageInvoices, canManageSettings, canManageStaff) ; `Coupon` { id?, code, discount_pct, active, store_id, created_at? } ; `StoreData` ; `StaffRole` = SUPER_ADMIN | OWNER | SELLER ; `NotificationType` = success | error | info | warning.

### Permissions (rôles STAFF/SELLER/OWNER… : qui voit quoi)

- Calcul : `getPermissionsForUser` (`src/utils/permissions.ts`). Propriétaire de la boutique (`stores.user_id = userId`) ou super-admin → `FULL_PERMISSIONS` + rôle 'OWNER'. Sinon, si ligne `store_staff` → permissions de sa colonne `permissions` si présente, sinon `FULL_PERMISSIONS` avec `canViewReports = role !== 'SELLER'` ; rôle = rôle enregistré. Sinon → `{}` + 'SELLER'.
- Effet sur l'écran : seul l'onglet « Équipe » est conditionné, par `permissions.canManageStaff`. Boutique, Profil et Promos restent visibles pour tout utilisateur ayant accès à la page.
- Un SELLER dont la colonne `permissions` est vide conserve `canManageStaff: true` par défaut → il voit l'onglet Équipe et peut ajouter/supprimer des membres.
- `userRole` n'est pas utilisé : aucune autre différence OWNER/SUPER_ADMIN.
- Accès à la route : filtre en amont par le layout `(app)` (redirection hors espace vendeur) et par `getEffectiveStoreId` (boutique possédée ou en personnel). Si aucune boutique : `currentStoreId = ''`, réglages par défaut (« Ma Boutique », XOF, fr) et le bouton Enregistrer crée une boutique via `createStoreAction`.
- Suppression de boutique absente de cet écran : `deleteStoreAction` existe dans `actions/settings.ts` mais n'est référencé nulle part. La suppression réelle de boutique est dans le menu boutique de la Navbar (`quickDeleteStoreAction`), réservée aux non-SELLER avec plus d'une boutique.

## Page /new-store (si présente côté web)

- Route `src/app/(app)/new-store/page.tsx` : composant serveur minimal qui rend `<NoStoreFound />`. Aucun autre contenu, aucune logique, aucun prop.
- Même écran réutilisé par dashboard, pos, orders, inventory, customers, invoices et reports quand `getEffectiveStoreId` renvoie `null`.

## Écran NoStoreFound (contenu exact)

- Fond de page `#f7f8fa`, plein écran, contenu centré, padding 16 px, overflow caché.
- Décor (non interactif) : halo rond orange en haut à droite (460 px, flou 80 px, `rgba(245,107,42,.22)`), halo sombre en bas à gauche (420 px, `rgba(0,47,52,.12)`), grille fine 56×56 px (`rgba(16,24,40,.05)`) masquée en ellipse centrale.
- Carte principale (largeur max 560 px, animation fade-in + slide-in-from-bottom 20 px, 500 ms) :
  - Fond blanc, border line (#eef0f2), rounded-[28px], padding 20 px, ombre douce.
  - Ligne marque (mb 24 px) : pastille 36×36 (w-9 h-9) rounded-xl dégradé orange (135°, #f56b2a → #e55a1b) avec icône Store 17 blanche (trait 2.5) ; mot « PosMarket » 13 px semibold ink ; à droite, poussé, « Étape 1 / 1 » 10 px semibold majuscules tracking-[0.14em] slate-400.
  - Titre « Bienvenue sur votre PDV ! » 24 px, line-height 1.12, semibold, tracking serré, ink.
  - Paragraphe « Pour commencer, donnez un nom à votre première boutique. C'est l'endroit où vous gérerez vos ventes et stocks. » 14 px, interligne détendu, slate-500, largeur max 440 px.
  - Formulaire (mt 24 px, espace vertical 20 px) :
    1. Label « Nom de votre boutique » 12,5 px semibold ink mb 8 px ; champ texte pleine largeur pl-11 pr-4 py-4, rounded-2xl, border line, 15 px medium, placeholder « ex: Ma Boutique Pro », icône Store 17 slate-400 à gauche, autofocus, requis, désactivé pendant la création.
    2. Bloc « Modèle de boutique » : libellé 12,5 px semibold ink mb 8 px ; groupe radio (aria-label « Modèle de boutique »), grille 1 colonne gap 10 px (la 2e colonne est réservée au breakpoint sm).
       - Carte « SHOP » : description « Shopping & E-commerce », icône ShoppingBag 18, puces « Stocks » et « Livraison » ; exemple de nom « ex: Ma Boutique Pro ».
       - Carte « RESTO » : description « Cuisine & Restauration », icône UtensilsCrossed 18, puces « Menu » et « Préparation ».
       - Carte : ligne alignée en haut, p-4, rounded-2xl, border ; sélectionnée = bordure brand + fond brand-soft/60 ; sinon bordure line + survol gris. Pastille icône 40×40 rounded-xl (sélectionnée : fond brand + icône blanche ; sinon fond slate-100 + icône slate-500). Libellé 12,5 px bold tracking-[0.08em] ; badge « CHOISI » (coche 9 + texte 9,5 px bold brand, fond brand/12, pilule) si sélectionnée ; description 11,5 px medium slate-500 ; puces 10 px semibold slate-500 sur fond blanc, bordure line, rounded-md. Indicateur rond 18×18 à droite : bordure brand + fond brand + coche blanche 11 si sélectionné, sinon bordure slate-300.
       - Sélection par défaut : SHOP.
    3. Bandeau erreur (si présent) : ligne, fond red-50, texte red-600 13,5 px medium, p-4, rounded-2xl, border red-100, icône CircleAlert 16.
    4. Bouton pleine largeur « Créer ma boutique » : pilule (rounded-full), py-4 px-6, texte 15 px semibold blanc, icône flèche ArrowRight 17 ; actif = fond brand + ombre orange ; désactivé (nom vide ou création) = fond #f7c9b0, curseur interdit. Pendant la création : spinner Loader2 18 + « Création en cours... ».
- Comportement : submit → `quickCreateStoreAction(nom, 'shopping'|'food')` ; succès → redirection `window.location.href = '/dashboard'` ; échec → message d'erreur de l'action ou « Une erreur est survenue » ; exception → « Erreur de connexion serveur ».
- Contraintes action : authentification requise (« Non authentifié ») ; limite selon l'abonnement (« Limite de N boutique(s) atteinte pour votre abonnement {plan}. Passez à un plan supérieur pour créer plus de boutiques. ») ; le cookie `currentStoreId` est posé sur la nouvelle boutique.
- Textes EXACTS : « PosMarket », « Étape 1 / 1 », « Bienvenue sur votre PDV ! », « Nom de votre boutique », « ex: Ma Boutique Pro », « Modèle de boutique », « SHOP », « Shopping & E-commerce », « Stocks », « Livraison », « RESTO », « Cuisine & Restauration », « Menu », « Préparation », « CHOISI », « Créer ma boutique », « Création en cours... ».

## Exclusions desktop (md:/lg: seulement)

- Sidebar (`src/components/Sidebar.tsx`) : `aside` en `hidden md:flex` (fond slate-900, 80 px) avec l'entrée « Réglages » (id tour `tour-sidebar-settings`). Desktop uniquement : sur mobile web la page /settings n'a aucune entrée de navigation dédiée (atteinte par URL).
- `SettingsView` (toutes les valeurs droites = mobile, gardées) :
  - Conteneur : `p-8` desktop ignoré (garder p-3).
  - En-tête : `md:text-2xl` (garder 18 px), `md:text-sm` sur le sous-titre (garder 10 px), bouton `md:px-6 md:py-3 md:text-sm md:rounded-xl` (garder px-4 py-2, 10 px, rounded-lg), icônes `md:size-*`.
  - Onglets : `lg:w-64 lg:flex-col lg:pb-0`, `md:gap-2/md:gap-3/md:px-4/md:py-3/md:rounded-xl/md:text-sm`, `md:mx-0 md:px-0` (garder la barre horizontale).
  - Carte contenu : `md:rounded-[32px] md:p-10` (garder rounded-3xl, p-3.5).
  - Logo boutique : `md:w-24 md:h-24` (garder 80 px), légende `md:text-[10px]`.
  - Grille des champs : `md:grid-cols-2` (garder 1 colonne), `md:gap-6`, `md:col-span-2` sur la description, `md:pl-11/md:py-3/md:rounded-2xl/md:text-sm/md:size-4`.
  - Note description : `md:text-[9px]`.
  - B2B : `md:text-sm`, `md:text-xs`, `md:py-3`, `md:text-[10px]`.
  - Profil : `md:p-10/md:flex-row/md:gap-10/md:rounded-[48px]`, `md:w-36 md:h-36`, `md:rounded-[42px]`, `md:text-left/md:justify-start`, `md:text-4xl/md:text-base/md:size-4/md:size-5`, bouton `md:p-3`.
  - Équipe : `sm:grid-cols-2 lg:grid-cols-3` (garder 1 colonne), `md:p-5`, `md:top-4 md:right-4`, `md:opacity-0` (garder opacité 60 %), `md:size-4`, `md:gap-4`, `md:w-12 md:h-12`, `md:rounded-2xl/md:rounded-3xl`, badges `md:text-[9px]`, `md:px-2`, `md:size-[10px]`, `md:text-[10px]`.
  - Promos : `md:rounded-3xl/md:p-6`, `md:flex-row`, `md:w-32`, `md:rounded-2xl`, `md:text-sm`, `md:px-5`, `md:py-16`.
  - Modale employé : `md:p-8`, `md:text-2xl`.
- `NoStoreFound` : variantes `sm:` — `sm:p-6` (garder p-4), `sm:p-8` (garder p-5), `sm:text-[28px]` (garder 24 px), `sm:grid-cols-2` (garder 1 colonne pour les modèles).
- Chrome desktop hors périmètre : cloche d'alertes vendeur supprimée, `hidden md:flex` du logo « MARKETPLACE / Voir le site » dans la Navbar, barre de recherche desktop « hidden md:flex » (voir spec navigation).

## Points ambigus / à vérifier

1. Aucune « zone de danger » dans /settings : ni suppression, ni désactivation de boutique. `deleteStoreAction` n'est branché nulle part ; la suppression de boutique vit dans le menu boutique de la Navbar (`quickDeleteStoreAction`, interdit si une seule boutique ou si SELLER). À arbitrer : ne pas l'inventer dans l'écran mobile.
2. `notify` n'est pas fourni par la page : aucun toast ne s'affiche réellement sur /settings (web). Tous les messages listés sont dans le code mais invisibles. Décider côté mobile si on les affiche (Snackbar/Toast) ou si on garde uniquement l'état « Prêt ! ».
3. Champs chargés mais non éditables : `address`, `ninea`, `currency` (XOF), `language` (fr). Aucun input correspondant dans l'UI ; `email` de la boutique est éditable mais pas celui du compte, et `phone` du compte non plus (contrairement à /mon-compte).
4. Onglet « Équipe » visible par un SELLER si sa colonne `permissions` en base est vide (défaut `canManageStaff: true`) ; sinon masqué. Vérifier le comportement souhaité en natif.
5. Modale employé : rôle figé « VENDEUR (SELLER) », pas de sélecteur, pas de champ mot de passe, pas de fermeture au clic sur le voile.
6. Message de confirmation de suppression de membre toujours générique (« ce membre de l'équipe ») : le nom n'est jamais transmis par la liste.
7. Pays : `CountrySelect` renvoie le nom (« Bénin ») et non le code ; l'onboarding (`MainLayout`) réutilise le champ `address` pour le « Pays de résidence » — risque de collision entre pays et adresse lors du portage.
8. Uploads : la vue produit des data-URI base64 via FileReader (pas d'équivalent natif direct) ; les actions serveur attendent un data-URI ou une URL http et déplacent l'image vers R2. Prévoir expo-image-picker + envoi/base64 équivalent.
9. Navigation par onglets URL (`?tab=`) et `router.push` / `window.location.search` : non portable tel quel, à remplacer par un état local.
10. Participant `stores` : la liste vient uniquement des boutiques possédées ; un membre (staff) d'une boutique d'autrui peut avoir `stores` vide → le sélecteur « Attribuer à la boutique » disparaît et le nom de boutique d'un membre retombe sur « Boutique ».
11. `userAvatarUrl` et `userRole` sont passés mais inutilisés : ne pas en déduire un affichage d'avatar ou des différences de rôle.
12. Le sous-composant `SettingItem` (ligne icône + titre + description + badge + chevron) est défini mais jamais rendu : ne pas le porter.
13. Le bouton Enregistrer de l'en-tête sauvegarde l'onglet Boutique (réglages boutique) même depuis Profil ou Promos ; l'onglet Profil a son propre bouton de sauvegarde. Comportement à conserver ?
14. Délai du feedback « Prêt ! » : 2 500 ms exactement.
15. Sur /settings, le titre « Réglages » et le texte des onglets sont en français uniquement (pas de i18n) ; l'écran NoStoreFound utilise « Étape 1 / 1 » (nommage d'assistant) alors qu'il n'y a qu'une étape.
