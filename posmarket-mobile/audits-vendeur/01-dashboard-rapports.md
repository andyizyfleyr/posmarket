# Dashboard & Rapports — spec mobile (parité web)

> Référence = rendu web à largeur mobile (< 768 px), c'est le design à copier.
> Fichiers web : `src/views/DashboardView.tsx` (1012 lignes), `src/views/ReportsView.tsx` (329 lignes), `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/reports/page.tsx`, squelette de navigation `src/app/(app)/loading.tsx`.
> Règle de lecture : classe sans variante = mobile ; `hidden md:*` / `hidden sm:*` = desktop → EXCLU ; `md:hidden` = mobile → INCLUS ; `text-[9px] md:text-[11px]` → 9 px. `lg:` = desktop.
> Aucune invention : tout élément absent de cette spec ne doit pas apparaître dans l'app.

Couleurs de référence : brand `#F56B2A` (`bg-brand` / `text-brand`), gray-50 `#F9FAFB`, gray-100 `#F3F4F6`, gray-200 `#E5E7EB`, gray-300 `#D1D5DB`, gray-400 `#9CA3AF`, gray-500 `#6B7280`, gray-600 `#4B5563`, gray-700 `#374151`, gray-800 `#1F2937`, gray-900 `#111827`, orange-50 `#FFF7ED`, orange-100 `#FFEDD5`, orange-500 `#F97316`, orange-600 `#EA580C`, yellow-500 `#EAB308`, green-50 `#F0FDF4`, green-100 `#DCFCE7`, green-500 `#22C55E`, green-600 `#16A34A`, blue-50 `#EFF6FF`, blue-500 `#3B82F6`, blue-600 `#2563EB`, purple-600 `#9333EA`, red-50 `#FEF2F2`, red-500 `#EF4444`, red-600 `#DC2626`, vert de la courbe `#10b981`, voile modale `slate-900/60`.

Chrome mobile commun (coquille vendeur, voir aussi 02-pos.md) : `Navbar` collant h-14 (56 px), z-100 — en mobile : logo/gauche masqué (desktop), badge d'abonnement (icône `Clock` 16 + texte 9 px majuscules), bouton globe 32×32 (`md:hidden`, ouvre `/store/{slug}` dans un nouvel onglet), avatar 32×32 (menu profil). `main` : colonne, padding bas 80 px (`pb-20`) pour la barre d'onglets, contenu animé au changement d'onglet (`animate-in fade-in slide-in-from-bottom-2`). `BottomNav` fixe bas (`md:hidden`) : onglets ≥ 52 px — Accueil, Vente, Commandes, Stocks, Clients (+ bouton « Plus » → menu « Rapports » pour tout rôle ≠ SELLER). Toasts globaux : fixés haut-droite (16 px), z-9999.

## Page /dashboard

### Données attendues (props + fournisseur)

`src/app/(app)/dashboard/page.tsx` (serveur) :
- `supabase.auth.getUser()` ; sans utilisateur → `null`.
- `getEffectiveStoreId(supabase, { user })` ; aucune boutique → `<NoStoreFound />` (écran de création de boutique, hors périmètre de cette spec).
- En parallèle : `loadOrdersForStore(storeId)` et `fetchStoreData(storeId, undefined, { orders: false, customers: false, invoices: false })`.
- `loadOrdersForStore` (`src/lib/load-store-data.ts`) = cache `unstable_cache` tag `orders:{storeId}`, revalidation 20 s, sur `fetchFormattedOrders` (`src/db/api.ts`) : les **100 dernières commandes** triées par date décroissante, avec leurs lignes (produit : id, name, price, image, unit, businessType, mainCategory) et le client joint (id, name, email, phone, address, totalSpent, ordersCount).
- `fetchStoreData` : permission `requireStoreAccess(storeId)` (sinon store null + listes vides) ; retourne `products` (max 200, stats `salesCount`/`reviewCount`/`rating`/`views` fusionnées, `price`/`wholesalePrice` en nombres, `businessType`, `mainCategory`, `variants`, `options`) et `store` (`toSnakeStore` : id, name, `business_type`, `views`, `settings`, slug, logo…).
- `getPermissionsForUser(supabase, user.id, storeId)` → `{ permissions, role }`.

Props de `DashboardView` :
- `orders: Order[]` — utilisées : `date`, `total`, `items[]` (`product`, `quantity`).
- `products: Product[]` — utilisées : `id`, `name`, `image`, `price`, `category`, `stock`, `views`, `salesCount`, `businessType`/`business_type`, `mainCategory`.
- `permissions: StaffPermissions` — **seul `canViewReports` est lu** (carte graphique).
- `userName?: string` — fourni = `store?.name || email.split('@')[0]` ; affiché dans la salutation et comme graine de l'avatar par défaut.
- `userAvatarUrl?: string | null` — avatar du profil (`user.avatarUrl`).
- `store?: { id, name?, business_type?: 'shopping'|'food', views?, … }`.
- `userRole?: StaffRole` — **non utilisé** par la vue.

Formatage : `formatCurrency` = entier tronqué, milliers séparés par une espace, suffixe « FCFA » (ex. « 12 500 FCFA ») ; `formatNumber` = compacte en « K »/« M »/« B » dès 1 000 (ex. « 1,2K »).

État de chargement : aucun spinner dans la vue (données serveur) ; le squelette `src/app/(app)/loading.tsx` (en-tête + 4 blocs stats + 4 lignes grises animées `skeleton`) s'affiche pendant la navigation serveur. Seul libellé de chargement : « Chargement... » dans le bouton de période tant que `mounted` est faux (hydration).

### Structure mobile (dans l'ordre)

1. **Conteneur racine** : colonne pleine hauteur, `overflow-y-auto` (le contenu défile), `overflow-x-hidden`, padding 8 px (`p-2`), fond gris très clair (`bg-gray-50/50`). C'est le seul niveau scrollable de la page (le web ajoute une scrollbar personnalisée masquée).

2. **En-tête** (colonne en mobile) :
   2.1 Ligne gauche : **avatar 32×32** visible uniquement en mobile (`md:hidden`), radius 12, bordure blanche, ombre ; image `userAvatarUrl` sinon `https://api.dicebear.com/7.x/avataaars/svg?seed={userName || 'user'}` (fond orange-50).
   2.2 Titre : `Salut, {userName || 'Utilisateur'} ` (16 px bold gray-900, tracking serré, une ligne tronquée) suivi de l'icône **`Hand` 20 px** en ligne (marge haute −4 px).
   2.3 Si `store.business_type` : badge à droite du titre — pilule fond orange-100 texte orange-700, padding 10/4 px, radius 8, texte **10 px** bold majuscules espacé ; libellé exact « **Resto** » si `food`, sinon « **Shop** ».
   2.4 Filtre de verticale — **uniquement si `store.business_type` est absent** : rangée horizontale scrollable sans barre, gap 8 px, marge haute 8 px. 3 boutons : « **Global** » (icône `Package` 14), « **Shopping** » (`ShoppingBag` 14), « **Resto** » (`Zap` 14). Style : px 16 py 8, radius 16, bordure 2 px, texte **10 px** bold, une ligne. Actif : Global = fond+bordure `gray-500` texte blanc + ombre ; Shopping = `orange-500` blanc + ombre ; Resto = `yellow-500` blanc + ombre. Inactif : fond blanc, bordure gray-100, texte gray-400. Le tap change `selectedVertical` (`all` | `shopping` | `food`).
   2.5 À droite (colonne desktop) : rien en mobile — le bloc « État système / Opérationnel / horloge » est `hidden md:flex` (voir exclusions) ; le conteneur `md:flex` reste vide en mobile.

3. **Grille des 4 statistiques** (ancre `id="tour-dashboard-stats"`) : 2 colonnes, gap 6 px (`gap-1.5`), marge basse 8 px.
   Anatomie d'une carte (`StatCard`, toutes en variante `compact`) : fond blanc, radius 16, bordure gray-100, ombre légère, padding 8 px.
   - Ligne haute (marge basse 6 px) : à gauche pastille d'icône padding 6 px, radius 12, texte blanc, ombre colorée 20 % (`shadow-{couleur}/20`), icône **14×14** ; à droite le badge de tendance (si présente) : pilule gap 2 px, texte **8 px** bold, px 6 py 2, radius plein ; hausse = texte green-600 fond green-50, baisse = texte red-600 fond red-50 ; **aucune flèche en mobile** (les flèches `ArrowUpRight`/`ArrowDownRight` 10 px sont conditionnées à `window.innerWidth > 768` et n'apparaissent jamais à largeur mobile) ; contenu = `{pct}%` (pourcentage plafonné à 100, arrondi).
   - Libellé : **9 px** bold gray-400 majuscules espacé, tronqué, marge basse 2 px.
   - Valeur : **14 px** bold gray-900, tracking serré, tronquée.
   Les 4 cartes, dans l'ordre :
   3.1 Titre « **Ventes Resto** » si `food`, sinon « **Ventes effectuées** » ; valeur `formatCurrency(revenue)` ; icône `DollarSign` ; couleur `bg-brand` ; tendance du CA.
   3.2 Titre « **Plats servis** » si `food`, sinon « **Commandes** » ; valeur = nombre de commandes (entier) ; icône `ShoppingBag` ; `bg-purple-600` ; tendance du nombre.
   3.3 « **Panier Moyen** » ; valeur `formatCurrency(panier moyen)` ; icône `Zap` ; `bg-blue-600` ; tendance du panier.
   3.4 « **Trafic Boutique** » ; valeur `formatNumber(trafic)` ; icône `Eye` ; `bg-orange-600` ; **pas de badge de tendance**.
   Calculs (fenêtre par défaut : aujourd'hui − 90 jours → aujourd'hui, dates locales) : CA = somme des `order.total` de la période ; commandes = nombre ; panier = CA / nombre (0 si aucune) ; trafic = `store.views` + somme des `product.views` (**toutes périodes**, indépendant des dates) ; tendance = comparaison avec la fenêtre précédente de même longueur (`prevStart = début − durée`, `prevEnd = début`) : `prev = 0` → 100 si courant > 0 sinon 0 ; sinon arrondi de `(courant − prev) / prev × 100` ; `pct = min(abs, 100)` ; verticale : `all` = toutes les commandes, sinon seules celles ayant ≥ 1 article dont le produit appartient à la verticale (`businessType`/`business_type`, sinon `mainCategory === 'Restauration & Livraison Rapide'` → food, sinon shopping).

4. **Colonne des blocs** (1 colonne en mobile, gap 12 px, padding bas 32 px) :

   4.1 **Carte « Comparaison des Performances »** — affichée **seulement si `permissions.canViewReports`**. Carte blanche, padding 8 px, radius 16, bordure gray-100, ombre légère, marge basse 8 px.
   - En-tête : pastille padding 6 px, radius 8, fond orange-50, texte brand, icône `BarChart2` 18 ; titre « **Comparaison des Performances** » (14 px bold gray-900, une ligne) ; sous-titre « **Analyse des revenus par période** » (10 px semibold gray-400, marge haute 2 px).
   - Bouton période (pleine largeur, marge haute 8 px) : px 16 py 10, fond blanc, bordure gray-200, radius 16, ombre légère ; à gauche pastille padding 6 px radius 8 fond orange-50 texte brand avec `Calendar` 14 ; au centre colonne : label « **Période d'analyse** » (8 px bold majuscules espacé gray-400) puis la valeur (10 px bold gray-700) ; à droite `ChevronRight` 14 gray-300 qui pivote à 90° quand la modale est ouverte. Valeurs : « **Chargement...** » avant montage ; si `startDate === endDate` → date longue fr (`j MMM yyyy`) ; sinon « `{j MMM} — {j MMM yyyy}` » (ex. « 21 juil. — 19 oct. 2026 »). Tap = ouvre/ferme la modale de période (voir Modales).
   - Graphique : zone de 192 px de haut (`h-48`), padding haut 24 px, bas 16 px, latéral 8 px. Fond : 4 lignes pointillées gray-100 superposées (haut/bas 40 px, côtés 24 px), sans étiquette Y. La courbe est un SVG `viewBox 0 0 100 100` (`preserveAspectRatio="none"`) : remplissage dégradé `#10b981` (25 % → 0 %) + ligne `#10b981` épaisseur 2,5 px, coins arrondis. Animation web à recréer : révélation par rideau de gauche à droite 1,2 s (délai 0,1 s), apparition échelonnée des points (`délai = index × 80 + 300` ms) et des étiquettes X (`index × 40 + 700` ms). Points : ronds **10×10 px** (bordure 3 px `#10b981`, fond blanc, ombre) — au survol/tap : agrandissement 1,4, remplissage vert, et infobulle centrée au-dessus (fond gray-900, texte blanc 10 px semibold, py 6 px px 12 px, radius 8) affichant `formatCurrency(valeur)` ; cliquer ailleurs n'a aucun effet.
   - Données du graphique (selon la période) : si la plage ≤ 1 jour → 7 points horaires « **8h, 10h, 12h, 14h, 16h, 18h, 20h** » (somme des totaux par tranches de 2 h) ; sinon entre 2 et 10 points (plafond 10, minimum = nombre de jours pour < 7 jours) répartis régulièrement ; étiquettes : plage ≤ 31 j → jour + mois court fr (« 21 juil. ») au 1er point, au dernier et à chaque changement de mois, sinon numéro du jour ; plage > 31 j → mois court + année 2 chiffres fr (« juil. 26 ») ; étiquettes « majeures » (contenant une espace ou plage > 31 j) en gray-600, les autres gray-400.
   - Étiquettes X en bas (hauteur 24 px, décalées de 16 px vers le bas), **8 px** semibold majuscules, gray-400 ; **en mobile, seules la première, la dernière et les index pairs sont affichées** (les index impairs sont `hidden md:block` → exclus) ; première étiquettée à gauche, dernière à droite, autres centrées.
   - Valeurs Y normalisées entre 10 et 90 (valeur / max × 80 + 10) ; ordonnée inversée (`100 − valeur`).

   4.2 **Carte « Plus Visités »** : fond blanc, radius 16, bordure gray-100, ombre, padding 12 px. En-tête : titre 14 px bold gray-900 avec icône `Eye` 16 texte blue-500, « **Plus Visités** » ; à droite « **Storefront** » (9 px bold gray-400 majuscules espacé).
   - Jusqu'à 5 produits ayant `views > 0` (filtrés par la verticale), triés par vues décroissantes.
   - Ligne : item cliquable (`cursor-pointer`) → navigation `/product/{id}` ; padding 6 px avec marge négative équivalente (surbrillance gris clair au survol), radius 12 ; à gauche vignette **32×32** radius 8, bordure gray-100, ombre, image `product.image` (`object-cover`) ; nom **10 px** semibold gray-900 tronqué (largeur max 100 px) ; prix dessous **9 px** semibold gray-400 `formatCurrency(product.price)`. À droite : vues **10 px** bold blue-600 (`formatNumber`) et libellé « **Vues** » 8 px bold gray-300 majuscules.
   - État vide : bloc centré py 24 px « **Aucune visite enregistrée** » (10 px semibold gray-300, une ligne).

   4.3 **Carte « Meilleures Ventes »** : même gabarit. En-tête : icône `Flame` 16 texte orange-500, « **Meilleures Ventes** » ; à droite « **Volume** » (9 px bold gray-400 majuscules).
   - Jusqu'à 5 produits avec ventes > 0 ; ventes calculées **uniquement depuis les commandes** (somme des quantités par produit, `item.quantity || 1`), avec repli sur `product.salesCount` si absent des commandes ; filtre verticale identique ; tri décroissant.
   - Ligne identique à 4.2 sauf : sous le nom, la **catégorie** (`product.category`) en 9 px semibold gray-400 (au lieu du prix) ; à droite « **x{n}** » (10 px bold orange-600, `formatNumber`) et libellé « **Vendus** » 8 px bold gray-300 majuscules ; tap → `/product/{id}`.
   - État vide : « **Aucune vente enregistrée** » (mêmes styles).

   4.4 **Carte alertes stock** : titre 14 px bold gray-900, marge basse 16 px, une ligne ; libellé « **Plats en Pause** » si `food`, sinon « **Alertes Stock** ».
   - Mode food : produits `food` avec `stock === 0`, max 6. Ligne : vignette 32×32 (comme 4.2) ; nom 10 px semibold gray-900 tronqué ; dessous un point rouge 8×8 + « **En pause** » (9 px bold red-500). Vide : « **Tous les plats sont disponibles** » (10 px gray-400, centré, py 24 px).
   - Mode shopping : produits `shopping` (ou verticale indéterminée) avec `stock < 15`, max 6. Ligne : vignette 32×32 ; nom 10 px semibold tronqué ; dessous une **barre de progression** hauteur 4 px fond gray-100 radius plein, remplissage `min(100, stock / 20 × 100) %` — red-500 si `stock < 5`, sinon orange-500 — et la valeur du stock (9 px bold, même couleur). Vide : « **Tous les stocks sont corrects** » (mêmes styles).
   - Aucun tap sur ces lignes.

### Modales / feuilles / menus

**Modale « Période d'analyse »** (sélecteur de dates personnalisé, ouverte par le bouton période de la carte graphique) :
- Voile : plein écran, noir 20 % + flou, z-9998, apparition en fondu 300 ms ; tap = fermeture sans appliquer.
- Dialogue : **centré** (pas une feuille basse), largeur 92 % de l'écran, fond blanc, radius 28 px, ombre forte, bordure gray-100, padding 24 px, z-9999 ; rôle dialogue, fermeture par `Échap` ; le fond de page est verrouillé pendant l'ouverture.
- Ligne d'étapes : deux puces cliquables « **1 · Début** » et « **2 · Fin** » (10 px bold, radius plein, px 10 py 4) — active : fond brand texte blanc ; inactive : fond gray-100 texte gray-500 — séparées d'un trait 16×1 px gray-200 ; à droite « **Recommencer** » (10 px bold gray-400) qui réinitialise le brouillon sur les dates appliquées et revient à l'étape 1.
- Rangée de raccourcis (scroll horizontal sans barre, marge basse 20 px) : « **Aujourd'hui** », « **Hier** », « **7 jours** », « **30 jours** », « **90 jours** », « **Ce mois** », « **12 mois** » (px 12 py 6, 11 px bold, radius 2 px, bordure ; actif = fond+bordure brand texte blanc) puis « **Réinitialiser** » (bordure pointillée gray-200, texte gray-400) qui remet le brouillon sur 90 derniers jours → aujourd'hui. Un raccourci applique immédiatement la plage et ferme la modale.
- Navigation du mois : `ChevronLeft` 14 (année précédente, gray-300) + `ChevronLeft` 16 (mois précédent, gray-400) ; au centre le mois + année fr (« octobre 2026 », 12 px bold majuscules, tap = revenir au mois courant) ; `ChevronRight` 16 (mois suivant) + `ChevronRight` 14 (année suivante, gray-300). Boutons px 8 py 8, radius 12.
- Calendrier : grille 7 colonnes, en-têtes « **Lun Mar Mer Jeu Ven Sam Dim** » (9 px bold gray-300 centrés), première colonne = lundi (décalage `(joursemaine+6)%7`). Chaque jour : case **44 px de haut**, texte **11 px** bold ; états — étape active (début sélectionné à l'étape 1, fin à l'étape 2) = fond brand texte blanc ombre ; début = fond brand texte blanc coins gauche arrondis 16 ; fin = idem coins droits ; jours intermédiaires = fond orange-50 texte brand ; jour courant = anneau intérieur 2 px brand (si non sélectionné) ; futur ou incohérent avec l'étape (`start > end` selon l'étape) = désactivé, gray-300 ; le premier tap fixe le début et avance à l'étape « Fin », le second fixe la fin.
- Pied (bordure haute gray-100, padding haut 16 px) : résumé sur 3 colonnes — « **Début** » (9 px bold gray-400 majuscules) + date (`j MMM yyyy` fr, 11 px bold gray-800) ; au centre « **{n} jour(s)** » (11 px bold brand ; si 0 → date courte `j MMM`, sinon « Aujourd'hui ») surmonté de « **période** » (8 px bold gray-300 majuscules espacé) ; « **Fin** » + date à droite. Puis 2 boutons pleine moitié : « **Annuler** » (py 12, fond gray-100, texte gray-600, radius 16, 11 px bold majuscules espacé) et « **Appliquer** » (py 12, fond gray-900, texte blanc, radius 16, même typo, ombre) qui valide `draftStart`/`draftEnd` en dates actives.

Aucune autre modale, feuille ou menu dans la vue. Les états du picker sont locaux (`isPickerOpen`, `pickerStep`, `draftStart`, `draftEnd`, `viewDate` initialisé sur la date de début).

### Actions & données utilisées (imports @/app/actions/*, supabase, fetch)

- La vue n'appelle **aucune** server action, **aucun** `fetch` et **aucun** client supabase direct. Elle reçoit tout par props (rendu serveur).
- Côté page : `supabase.auth.getUser()` (client serveur `@/utils/supabase/server`), `getEffectiveStoreId` (`@/utils/store-cookie`), `loadOrdersForStore` (`@/lib/load-store-data`), `fetchStoreData` (`@/app/actions/store`, qui contrôle `requireStoreAccess`), `getPermissionsForUser` (`@/utils/permissions`).
- Imports de la vue : `useRouter` (`@/components/RouterPolyfill` → `next/navigation`), `Image` de `next/image` (avatar + vignettes, `unoptimized` pour l'avatar, tailles 32 px), `formatCurrency`/`formatNumber` (`@/utils`), icônes lucide : `BarChart2, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, Clock, Calendar, Eye, Flame, ChevronLeft, ChevronRight, Zap, Package, Hand` (les flèches et `Clock` ne servent qu'au desktop).
- Navigation : tap sur une ligne produit → `router.push('/product/{id}')` (page produit publique, route `src/app/product/[slug]`).

### Permissions

- `permissions.canViewReports` : **seule** condition d'affichage de la carte « Comparaison des Performances » (graphique + bouton période + modale). Les 4 statistiques et les 3 listes sont toujours affichées.
- Contexte page : session requise et espace vendeur autorisé (`canAccessSellerSpace`), sinon redirection (`(app)/layout.tsx`). Sans abonnement valide, toutes les vues sauf « subscription » sont remplacées par l'écran « Abonnement Requis ».
- `getPermissionsForUser` : propriétaire ou super-admin → permissions complètes + rôle OWNER ; membre du staff → `staff.permissions` sinon permissions complètes **sauf `canViewReports`** pour un SELLER.
- Aucune garde locale supplémentaire (aucun bouton d'action métier sur cette page).

## Page /reports

### Données attendues (props + fournisseur)

`src/app/(app)/reports/page.tsx` (serveur) :
- `supabase.auth.getSession()` ; sans session → `null`.
- `getEffectiveStoreId(supabase, session)` ; aucune boutique → `<NoStoreFound />`.
- En parallèle : `loadOrdersForStore(storeId)` et `fetchStoreData(storeId, undefined, { products: false, invoices: false })`.
- Données : `orders` = 100 dernières commandes (voir /dashboard) ; `customers` = 100 derniers clients ; `store` (`toSnakeStore`, contient `settings`) ; `storeSettings` = `store?.settings`.
- `getPermissionsForUser(supabase, session.user.id, storeId)`.

Props de `ReportsView` :
- `orders: Order[]` — utilisées : `id`, `date`, `total`, `paymentMethod`, `customer?.name`, `items[]` (`quantity`, `variantLabel`, `product.{name, sku, price, unit, image}`).
- `storeSettings: StoreSettings` — utilisés : `name`, `address`, `phone`, `email` (reçu).
- `customers`, `store`, `permissions`, `userRole` — **jamais lus** par la vue (la vue ne déstructure que `orders` et `storeSettings`).

État de chargement : aucun (données serveur) ; squelette `(app)/loading.tsx` pendant la navigation.

### Structure mobile (dans l'ordre)

1. **Conteneur racine** : colonne, hauteur plein écran **sans scroll global** (`overflow-hidden`), padding 12 px, fond gris très clair (`bg-gray-50/30`). Seule la liste intérieure défile.

2. **En-tête** :
   - Titre « **Historique** » (18 px bold gray-900, une ligne) ; sous-titre « **Consultez vos transactions passées.** » (10 px gray-500, tronqué, marge haute 2 px).
   - À droite, 2 boutons côte à côte (gap 8 px), **sans action** sur le web (aucun `onClick`) : « **Période** » (icône `Calendar` 14) et « **Filtrer** » (icône `Filter` 14) ; fond blanc, bordure gray-100, radius 8, px 12 py 6, texte 10 px bold gray-600, ombre légère, une ligne.

3. **Conteneur liste** : carte blanche, bordure gray-100, radius 24, ombre légère, occupe le reste de la hauteur en colonne ; zone intérieure scrollable.
   - **Si au moins une commande** — liste mobile (pas de tableau, pas d'en-tête de colonnes) avec traits séparateurs gray-100 :
     - Ligne : tap → ouvre la modale de détail (`selectedOrder`) ; padding px 8 py 6 ; surbrillance orange-50 au survol.
     - Gauche : pastille 28×28, radius 8, fond orange-50, texte brand, icône `FileText` 14 ; à côté, colonne : numéro « **#{6 derniers caractères de l'id, en majuscules}** » (11 px bold gray-900, une ligne) + l'heure `HH:mm` fr (9 px semibold gray-400) ; seconde ligne (mobile) : nom du client (`order.customer?.name || 'Passage'`, 10 px semibold gray-500, tronqué à 70 px), séparateur « | » gray-200, montant `formatCurrency(order.total)` (10 px bold brand).
     - Droite : badge de moyen de paiement (**7 px** bold, px 4, radius 4, une ligne, espacement resserré) — « **ESP** » si CASH (fond green-50, texte green-600), « **MM** » si MOBILE_MONEY, « **CBE** » si CARD, sinon « **VIR** » (ces trois derniers : fond blue-50, texte blue-600) ; puis chevron `ChevronRight` 12 gray-300 (décoratif).
   - **Si aucune commande** : bloc centré plein cadre (padding 80 px, gap 16 px) — icône `FileText` 64 px à 10 % d'opacité ; « **Aucune commande** » (18 px bold gray-900) ; « **Les ventes apparaîtront ici.** » (12 px gray-500, marge haute 4 px).

### Modales / feuilles / menus

**Modale « Détails de commande »** (centrée, y compris en mobile) :
- Voile plein écran z-100, `slate-900/60` + flou léger ; tap hors panneau non géré (pas de fermeture au clic sur le voile).
- Panneau : blanc, radius 24, ombre très forte, largeur pleine (marge 16 px), hauteur max 90 % de l'écran, colonne.
- En-tête collant (padding 12 px, bordure basse gray-100) : titre « **Commande #{6 derniers caractères, majuscules}** » (16 px bold gray-900, une ligne) ; dessous la date complète `toLocaleString('fr-FR')` (8 px gray-400 majuscules espacé) ; à droite bouton fermer `X` 18 px gray-400 (padding 6 px, survol fond gray-50, arrondi plein) qui vide `selectedOrder`.
- Corps scrollable, colonne :
  - Section « **Client** » (label 8 px bold gray-400 majuscules espacé) : carte fond `gray-50/50`, padding 10 px, radius 12, bordure gray-50. Si client : pastille 36×36 radius 8 fond brand texte blanc, initiale du nom en 16 px bold, ombre orange ; nom 12 px bold gray-900 tronqué ; e-mail 9 px gray-500 tronqué. Sinon : pastille 36×36 radius 8 fond gray-100 avec icône `User` 18 ; « **Passage** » 12 px semibold italique gray-400.
  - Section « **Paiement** » : même carte ; pastille 36×36 radius 8 fond green-600 texte blanc avec `CreditCard` 18, ombre verte ; libellé 9 px bold gray-900 majuscules — « **Espèces** » si CASH, « **Carte B.** » si CARD, sinon « **Virement** » (MOBILE_MONEY compris) ; dessous « **Payé** » 8 px bold green-600 majuscules espacé avec `CheckCircle2` 8.
  - Section « **Articles** » : une carte par ligne — padding 8 px, fond blanc, bordure gray-50, radius 12, ombre légère ; vignette 36×36 radius 8 bordure gray-100 (`<img>` object-cover) ; nom 10 px bold gray-900 tronqué ; SKU 8 px gray-400 police mono tronqué ; si variante : label 8 px gray-600 italique ; à droite : « `{quantité}{unité si ≠ 'pièce'} x {prix unitaire}` » (8 px semibold gray-400) et total de ligne 10 px bold brand.
  - Colonne « **Aperçu du Reçu** » (pleine largeur, bordure haute gray-100, fond `gray-50/50`, padding 16 px, contenu centré) : titre « **Aperçu du Reçu** » (10 px bold gray-400 majuscules espacé, marge basse 16 px), puis le ticket :
    - Bloc blanc, ombre forte, bordure gray-100, padding 16 px, police mono, texte 9 pt, radius 2 px (identifiant `receipt-print` ; sur le web, l'impression n'imprime que ce bloc, largeur 80 mm — voir Points ambigus).
    - En-tête centré (bordure basse pointillée gray-300, padding bas 16 px) : nom de la boutique (`storeSettings.name || 'Boutique'`) 14 px bold majuscules ; adresse 7 pt gray-600 ; ligne « téléphone • e-mail » 7 pt gray-500 mono (éléments vides retirés, séparateur « • ») ; bloc marge haute 12 px 7 pt gray-500 : « **CMD #{8 derniers caractères, majuscules}** » puis la date complète fr.
    - Lignes d'articles (gap 4 px, marge basse 16 px) : nom (tronqué) + « (label de variante) » le cas échéant à gauche ; à droite « `{quantité}{unité si ≠ 'pièce' sinon rien} {prix unitaire}` ».
    - Total (séparateur pointillé gray-300, padding haut 12 px) : ligne « **TOTAL:** » et `formatCurrency(order.total)` en 16 px bold brand (filet supérieur gray-200).
    - Pied centré 7 pt gray-400 (filet pointillé, padding haut 16 px) : « **MERCI DE VOTRE VISITE !** » semibold.
  - Boutons (colonne, marge haute 24 px, gap 10 px) : « **Imprimer** » (icône `Printer` 16 ; fond blanc, bordure gray-100, radius 12, py 12, 12 px bold gray-600, ombre légère) et « **Télécharger PDF** » (icône `Download` 16 remplacée par `Loader2` 16 animée pendant la génération ; fond brand, texte blanc, radius 12, py 12, 12 px bold, ombre orange ; désactivé à 60 % d'opacité pendant la génération ; libellé « **Génération...** » pendant, sinon « **Télécharger PDF** »).

### Actions & données utilisées (imports @/app/actions/*, supabase, fetch)

- La vue n'appelle **aucune** server action, **aucun** `fetch` et **aucun** client supabase direct.
- Côté page : `supabase.auth.getSession()`, `getEffectiveStoreId`, `loadOrdersForStore`, `fetchStoreData` (`@/app/actions/store`), `getPermissionsForUser`.
- Imports de la vue : `jspdf` (`jsPDF`) et `html2canvas` — impression/PDF web uniquement :
  - « Imprimer » : remplace temporairement `document.title` par le nom de la boutique, appelle `window.print()`, puis restaure le titre.
  - « Télécharger PDF » : capture du ticket `html2canvas` (échelle 2, fond blanc, CORS autorisé), export PNG inséré dans un PDF `jsPDF` portrait de **80 mm** de large (hauteur proportionnelle), nom de fichier « **Recu-{id de la commande}.pdf** » ; erreurs seulement journalisées en console ; bouton réactivé dans tous les cas.
- Icônes lucide : `FileText, Calendar, Filter, ChevronRight, Printer, Download, X, CreditCard, User, CheckCircle2, Loader2`.

### Permissions

- **Un SELLER n'accède pas à cette page** : `MainLayout` redirige vers `/dashboard` dès que `currentView === 'reports'` et que le rôle est SELLER (rendu `null`).
- Contexte page identique à /dashboard (session vendeur requise, abonnement valide obligatoire).
- Aucune permission n'est lue dans la vue (`permissions`/`userRole` reçus mais ignorés) : aucun élément conditionnel.

## Exclusions desktop (md:/lg:/sm: seulement)

Dashboard :
- `StatCard` : `md:rounded-3xl`, `md:p-6`, `md:mb-5`, `md:rounded-2xl`, `md:p-3.5`, `md:w-6 md:h-6`, `md:gap-1`, `md:px-2`, `md:py-1`, `md:text-[10px]`, `md:w-3.5 md:h-3.5`, `md:text-[11px]`, `md:mb-1`, `md:text-2xl`.
- Racine `md:p-8` ; en-tête `md:flex-row md:items-center md:mb-8 md:gap-6 md:gap-4` ; titre `md:text-3xl` ; filtre de verticale `md:mt-4` et `md:text-xs` sur les boutons.
- Bloc droite de l'en-tête : conteneur `md:flex` (vide en mobile) ; carte « **État système / Opérationnel / horloge `HH:mm`** » entièrement `hidden md:flex` (labels « État système », « Opérationnel ») ; séparateur vertical `hidden md:block`.
- Carte graphique : `lg:col-span-3`, `md:rounded-3xl`, `md:p-6`, en-tête `md:flex-row md:items-center md:mb-8 md:gap-4 md:gap-3`, pastille `md:p-2.5 md:rounded-xl`, icône `md:w-6 md:h-6`, titre `md:text-lg`, sous-titre `md:text-xs`, bouton `md:w-auto` (×2), valeur `md:text-xs`, modale `sm:w-[380px] md:w-[400px]` (mobile : 92 %).
- Zone graphique : `md:h-64`, `md:pt-10`, `md:pb-6`, `md:px-6` ; points `md:w-3.5 md:h-3.5` ; étiquettes X `md:text-[10px]`, `md:tracking-widest`, et les étiquettes d'index impairs `hidden md:block`.
- 3 listes : `md:rounded-3xl`, `md:p-6`, `md:mb-6`, titres `md:text-lg`, labels droits `md:text-[10px]`, `md:space-y-4`/`md:space-y-5`, vignettes `md:w-10 md:h-10` / `md:w-12 md:h-12`, `md:rounded-xl`, `md:gap-3`/`md:gap-4`, noms `md:text-xs`, prix `md:text-[10px]`, vues `md:text-xs`, états vides `md:text-xs` / `md:text-sm` et `md:py-10`, barre de stock `md:h-1.5`, « En pause » `md:text-[10px]`, `md:mt-1.5`.
- L'avatar 32×32 et l'anneau/effets `hover:` restent, mais les effets de survol (scale, ombre, rotation) sont sans objet en natif.
- `Clock`, `ArrowUpRight`, `ArrowDownRight` ne sont exploitables que côté desktop.

Rapports :
- Racine `md:p-8` ; en-tête `md:flex-row md:items-center md:mb-8 md:gap-4` ; titre `md:text-2xl` ; sous-titre `md:text-sm md:mt-1` ; boutons `md:px-4 md:py-2 md:rounded-xl md:text-sm`, icônes `md:w-4 md:h-4`.
- **Tout l'en-tête de tableau** `hidden md:table-header-group` (« ID Commande / Date & Heure / Client / Méthode / Articles / Total / Actions ») et toutes les cellules de colonnes `hidden md:table-cell` (date + heure, client « Client de passage », méthode complète « Espèces/Mobile Money/Carte/Virement », « N articles », total, bouton chevron) → seul le rendu en lignes empilées mobile subsiste.
- Ligne : `px-2 md:px-6 py-1.5 md:py-4`, pastille `w-7 h-7 md:w-10 md:h-10`, `FileText md:w-4 md:h-4`, id `md:text-sm`, badge paiement `md:text-[8px] md:px-1.5 md:py-0.5`.
- Modale : `md:px-6 md:py-6`, titre `md:text-xl`, sous-titre `md:text-[10px]`, `X md:size-6`, corps `md:flex-row`, colonne gauche `md:p-8`, `md:grid-cols-2 md:gap-8`, `md:space-y-4`, cartes `md:p-4 md:rounded-2xl`, pastilles `md:w-12 md:h-12`, `gap md:gap-3`, icônes `md:size-6`, textes `md:text-base`/`md:text-xs`, lignes articles `md:p-3 md:rounded-xl`, noms `md:text-sm`, colonne reçu `md:w-[350px]`, `md:border-t-0 md:border-l`, `md:p-6`, `md:mb-6`, `md:mt-8 md:space-y-3`, boutons `md:py-4 md:rounded-2xl md:text-base`, icônes `md:w-[18px] md:h-[18px]`.
- Impression (`@media print`) : comportement web uniquement (`body > *:not(.print-only)` masqué, ticket forcé en 80 mm) — sans objet en natif.

À conserver (`md:hidden` = mobile) : avatar de l'en-tête dashboard, heure dans la ligne de commande rapports, badge paiement + chevron de la liste, secondes lignes mobiles des lignes de commande.

## Points ambigus / à vérifier

1. **Flèches de tendance** : la condition `compact || window.innerWidth > 768` masque toujours les flèches des 4 cartes stats à largeur mobile ; ne pas les recréer en natif (seul le `%` s'affiche).
2. **Filtre de verticale conditionnel** : la rangée Global/Shopping/Resto n'apparaît que si `store.business_type` est absent ; quand il existe, `selectedVertical` est initialisé (et resynchronisé) sur cette valeur, donc les statistiques ne comptent que les commandes contenant des articles de cette verticale. Comportement à reproduire tel quel.
3. **`getVertical`** : priorité à `businessType`/`business_type` du produit ; repli sur la chaîne exacte `mainCategory === 'Restauration & Livraison Rapide'` ; défaut « shopping ». Toute autre catégorie food (ex. « Alimentation ») retombe en shopping.
4. **Graphique** : SVG + animations de révélation (rideau, pop des points) et infobulles au survol — à transposer en `react-native-svg` avec déclenchement au tap (pas de hover tactile) ; les étiquettes X mobiles n'affichent que les index pairs + premier + dernier ; aucune étiquette Y ni valeur sur la courbe.
5. **Sélecteur de dates** : le web n'a **pas** de `<input type="date">` mais un calendrier custom complet (étapes 1-2, raccourcis, navigation année/mois, restrictions début ≤ fin, dates futures désactivées) — c'est ce composant qu'il faut porter, pas un picker natif simplifié.
6. **Verrou de scroll et fermeture Échap** de la modale de période : mécanismes web à adapter (ou à considérer comme sans objet) en natif.
7. **Liens produit** : les lignes « Plus Visités »/« Meilleures Ventes » poussent `/product/{id}` (page produit publique) ; l'app devra avoir une route équivalente ou désactiver le tap.
8. **Boutons « Période » et « Filtrer »** de /reports : présents mais **inactifs** sur le web (aucun `onClick`). Décider si on les garde décoratifs (parité) ou fonctionnels.
9. **Aucun filtre/recherche/pagination** sur /reports : la liste = 100 dernières commandes max, tri date décroissante, scroll interne à la carte.
10. **Moyens de paiement incohérents entre vues** : liste = « ESP/MM/CBE/VIR » ; modale = « Espèces/Carte B./Virement » (MOBILE_MONEY affiché « Virement ») ; desktop = « Espèces/Mobile Money/Carte/Virement ». Conserver les libellés mobiles exacts.
11. **Numéro de commande** : dernier 6 caractères (liste + titre modale) mais **8 derniers** sur le reçu imprimé.
12. **Impression / PDF web-only** : `window.print()`, `html2canvas`, `jsPDF` (ticket 80 mm, nom « Recu-{id}.pdf ») et `document.title` temporaire ; prévoir un équivalent natif (ex. `expo-print` + partage) ou masquer les boutons.
13. **Formats de dates fr-FR** (`toLocaleDateString`/`toLocaleString` avec options) : vérifier le support Intl complet sur Hermes (build Android) ou prévoir un polyfill.
14. **`storeSettings`** : la page passe `store?.settings` sans garde ; si `store` est null le reçu lèverait une erreur web. En pratique `NoStoreFound` protège. En natif, prévoir un défaut.
15. **Statistiques de trafic** : `store.views` + somme des `product.views` — métrique **cumulative toutes périodes**, sans tendance, plafonnée par le formatage compact (`formatNumber` → « K »/« M »).
16. **Seuils des alertes stock** : shopping = `stock < 15` (max 6 lignes, barre = stock/20, rouge si < 5) ; food = `stock === 0` strictement (max 6 lignes) ; tout autre état vide affiche le message dédié.
17. **Images produit** : le web utilise `next/image` avec `fill` ; une image vide/absente doit prévoir un placeholder visuel en natif (vignettes 32×32 et 36×36).
18. **Ancres de visite guidée** (`tour-dashboard-stats` sur la grille stats, `tour-mobile-*` sur la BottomNav) : aucun moteur de visite ne les consomme dans ce dépôt (seules ces deux références existent) ; ne rien inventer côté app.
19. **Squelette de navigation** `(app)/loading.tsx` : visible sur toutes les routes du groupe — en natif, décider d'un état de chargement équivalent (en-tête, 4 blocs, 4 lignes).
20. **Toasts** : la page dashboard ne déclenche aucun toast ; /reports non plus. Les toasts visibles viennent uniquement du layout global (haut-droite) et des actions d'autres vues.
21. **Cartes stats** : la valeur de « Commandes » est un nombre brut (pas de `formatNumber`) ; seuls CA, panier et trafic sont formatés (`formatCurrency`/`formatNumber`).
22. **Carte graphique masquée** : sans `canViewReports`, la grille passe directement aux 3 listes (aucun espace réservé, aucune carte vide) — c'est aussi le cas pour un SELLER.
