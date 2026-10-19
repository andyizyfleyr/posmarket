# POS (Point de Vente) — spec mobile (parité web)

Références web : `src/views/POSView.tsx` (vue unique, tout le POS), `src/components/ProductImage.tsx` (image produit), `src/components/Loader.tsx` (spinner), `src/components/Toast.tsx` (toasts locaux). Fourniture des données : `src/app/(app)/pos/page.tsx`. Chrome : sur le web mobile de la coquille vendeur, `BottomNav` (`md:hidden`, fixe en bas, item ≥ 52 px + safe-area) et 80 px de padding bas ; la barre panier POS est posée à 68 px du bas (hauteur de cette barre d'onglets).

Aucun `TransactionResultModal`, `ConfirmationModal`, `BottomSheet`, `PhoneInput` n'est utilisé par le POS : la modale succès, la feuille panier et les sélecteurs sont des blocs JSX internes à POSView. Imports composants réels : ProductImage, Loader, Toast.

Couleurs de référence : brand `#F56B2A`, fin de dégradé `#E04E0F`, gris Tailwind (gray-50 `#F9FAFB`, gray-100 `#F3F4F6`, gray-200 `#E5E7EB`, gray-300 `#D1D5DB`, gray-400 `#9CA3AF`, gray-500 `#6B7280`, gray-600 `#4B5563`, gray-800 `#1F2937`, gray-900 `#111827`), amber-500 `#F59E0B`, red-500 `#EF4444`, green-600 `#16A34A`, green-50 `#F0FDF4`, green-100 `#DCFCE7`, orange-50 `#FFF7ED`, orange-100 `#FFEDD5`, orange-200 `#FED7AA`, brun texte bandeau `#7A3C14`, texte gros actif `#D94F0A`.

## Données attendues (props + fournit par src/app/(app)/pos/page.tsx)

Props de `POSView` (toutes issues de `page.tsx`) :
- `products: Product[]` — id, name, price (number), stock, image, unit?, category, mainCategory?, businessType?, options?, variants? (id, name, optionValues, price, stock, sku?, image?), wholesaleTiers?/wholesalePrice?/wholesaleMinQty?.
- `customers: Customer[]` — 100 derniers clients (id, name, phone, email?, address, totalSpent, ordersCount).
- `currentStoreId?: string` — id de la boutique courante (cookie `currentStoreId`).
- `storeSettings: StoreSettings` — name, email, phone, address, ninea, logo?, businessType? ; sert au reçu (fallback nom « Point de Vente »).
- `permissions: StaffPermissions` — seul `canManageOrders` est lu.
- `notify?` — callback toast global ; **non fourni** par `page.tsx` (voir Points ambigus).
- `businessType?: string` — `store.business_type` ; seule la valeur `'food'` change des libellés.

Chargements internes à la vue :
- Coupons : `supabase.from('coupons').select('*').eq('active', true).eq('store_id', currentStoreId)` au montage et à chaque changement de boutique ; erreur avalée (« Coupons table not available »).
- Stock : `getStockCountsAction(currentStoreId)` au montage puis toutes les 5 s (badges des cartes).
- Horloge live : `toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })`, maj toutes les 30 s.
- Aucun paiement en ligne : pas de useKkiapay/useFedapay/useFeexpay ; `PaymentMethod` limité à CASH / MOBILE_MONEY dans l'UI.

Côté serveur : `fetchStoreData(storeId, undefined, { orders:false, invoices:false })`, `getPermissionsForUser(supabase, userId, storeId)`, `getEffectiveStoreId` ; si aucune boutique → `NoStoreFound`.

## Structure mobile (dans l'ordre)

1. **Conteneur racine** : `flex flex-grow overflow-hidden h-full relative`, fond `bg-gray-50/30`. Colonne produits masquée quand la feuille panier est ouverte (`hidden` sur mobile). Vue plein écran sans scroll global (la liste produits scrolle seule).

2. **En-tête POS** (dans la colonne produits) : bandeau blanc, bordure basse gray-100, padding 12 px H / 10 px V, flex gap 12 px.
   2.1 Pastille dégradé brand→#E04E0F, padding 6 px, radius 12, ombre orange 30 % : icône Sparkles 16 px blanche.
   2.2 Bloc nom boutique + horloge : `hidden sm:block` → **exclu du rendu < 640 px** (nom 14 px bold ; sous-titre 9 px semibold gray-400 uppercase tracking-widest, texte `{heure} • POS`).
   2.3 Recherche (flex-grow, relative) : icône Search 14 px gray-300 à gauche (12 px) ; champ pl 36 px / pr 16 px, py 8 px, fond gray-50, bordure gray-100, radius 12, texte 12 px, placeholder exact « Rechercher un produit... » ; si texte saisi, bouton X 14 px à droite (12 px) qui vide le champ.
   2.4 Bouton « Gros » : flex gap 6 px, px 12 py 8, radius 12, bordure, texte 10 px bold, icône BadgePercent 14 px ; actif = fond brand, bordure brand, texte blanc, ombre orange-100 ; inactif = fond gray-50, bordure gray-100, texte gray-500. Tooltip/title : « Ajouter directement la quantité du palier de gros (dès) en un tap ». Bascule le mode gros (état `bulkMode`).
   2.5 Badge compteur produits : `hidden md:flex` → **exclu** (desktop).

3. **Bandeau catégories** : fond blanc, bordure basse gray-50, padding 12 px H / 8 px V. Rangée horizontale scrollable sans barre (flex-nowrap, gap 6 px). Chips : px 12 py 6, radius 12, texte 9 px bold uppercase tracking-wider, whitespace-nowrap ; actif = fond brand texte blanc ombre orange-100 ; inactif = fond gray-50 bordure gray-100 texte gray-500. Première chip = « Tout » (valeur `all`). Ordre = ordre d'apparition des produits, catégorie = `mainCategory` sinon `category` (dédupliquées). Le scroll molette horizontal du web n'a pas d'équivalent mobile.

4. **Zone grille produits** : scroll vertical, padding 12 px H / 12 px V, **padding bas 112 px (`pb-28`)** pour ne pas cacher la dernière rangée sous la barre panier.
   4.1 Si mode gros actif : bandeau `bg-orange-50` bordure orange-100 radius 12 px 12 py 8, icône BadgePercent 14 px brand, texte 10 px bold `#7A3C14` : « Mode gros actif : un tap ajoute la quantité du palier « Dès N », ou ouvre le choix des paliers si le produit en a plusieurs. »
   4.2 Grille : **3 colonnes sous 640 px** (base `grid-cols-3`), gap 8 px. (Le web passe à 4 colonnes dès 640 px via `sm:` ; lg/xl/2xl = desktop.)
   4.3 Aucun résultat : bloc centré vertical 80 px, carré gray-100 64 px radius 16 avec Search 28 px gray-300, puis « Aucun produit trouvé » (14 px semibold gray-400) et « Essayez un autre terme de recherche » (10 px gray-300).
   4.4 Aucun squelette/chargement produits (données serveur).

5. **Carte produit POS** (bouton plein, memoïzée) :
   - Fond blanc, radius 16, bordure gray-100, ombre légère ; état tapé (300 ms) = bordure brand + ring brand 20 % + ombre orange-100 ; rupture = opacité 50 %.
   - Image carrée 1:1 pleine largeur (fond gray-50, ProductImage objectFit cover ; fallback icône ImageIcon 32 px gray-300).
   - Overlay feedback tap : voile brand 10 %, 200 ms.
   - Pastille ajout en bas-droite (6 px) : rond **28 px** ; si mode gros + palier : fond brand, texte blanc, contenu BadgePercent 11 px + quantité min (7 px bold) ; sinon fond blanc 90 % translucide, Plus 14 px strokeWidth 3, texte gray-600 ; masquée si rupture.
   - Badge stock bas en haut-gauche : fond amber-500, texte blanc, px 6 py 2, radius 6, texte 7 px bold uppercase, AlertTriangle 8 px + « {stock} restant » (+ « s » si > 1). Apparaît si 0 < stock ≤ 5.
   - Badge stock restant en haut-droite : px 6 py 2, radius 6, texte 7 px bold blanc, icône Package 8 px + nombre ; fond red-500 si 0, amber-500 si ≤ 5, sinon gray-900/70.
   - Rupture : voile blanc 60 % + pilule gray-900/80, texte blanc, px 12 py 4, radius 8, 9 px bold uppercase tracking-wider, mot « Rupture ».
   - Bloc infos (padding 6 px) : nom 9 px semibold gray-800 ligne unique (line-clamp-1) ; prix 11 px bold gray-900 (`formatCurrency`) ; si variantes : « N variante » (+ s) 7 px bold gray-400 uppercase ; si palier de gros : ligne 7 px bold (brand, ou #D94F0A en mode gros) BadgePercent 8 px + « Dès {minQty} : {prix unitaire} ».
   - Tap : rupture → toast local « {nom} est en rupture de stock », type error, titre « Produit indisponible » ; produit à variantes → ouvre le sélecteur de variante (aucun ajout aveugle) ; mode gros + 1 palier → ajoute directement la quantité du palier ; mode gros + plusieurs paliers → ouvre le sélecteur de paliers ; sinon ajoute 1 unité.

6. **Barre panier flottante mobile** (`cart.length > 0` et feuille fermée) : fixe, bas 68 px, gauche/droite 12 px, z-40, dégradé brand→#E04E0F, texte blanc, px 16 py 12, radius 16, ombre brand 40 %.
   - Gauche : ShoppingBasket 18 px + badge rond blanc 16 px (texte brand 8 px bold) positionné -6 px haut / -8 px droite avec `totalItems` ; total (`formatCurrency`) 14 px bold.
   - Droite : « Voir le panier » 14 px bold + ArrowRight 16 px. Libellé **figé**, non dépendant de la verticale.
   - Tap → ouvre la feuille panier. Léger scale 98 % au tap.

7. **Feuille panier (bottom sheet)** : plein écran z-60, colonne ; backdrop noir 40 % + flou 2 px (tap = fermeture) ; feuille en bas, fond blanc, radius haut 24, hauteur max 92 vh, animation montée ; poignée : conteneur py 8 px centré, barre 40×4 px gray-200 radius plein.
   7.1 En-tête panier (collant, px 16 py 12, bordure basse gray-100) : chevron **ChevronDown 20 px** (`md:hidden`, visible en mobile) qui ferme la feuille ; pastille dégradé Receipt 16 px (padding 6, radius 12) ; titre 14 px bold = `cartWord` (« Panier » / « Commande ») ; sous-titre 9 px semibold gray-400 uppercase tracking-widest = « {totalItems} article » (+ « s » si > 1) ; à droite bouton « Vider » (9 px semibold gray-400, px 8 py 4, uppercase tracking-wider) visible seulement si panier non vide (vide panier + client + promo).
   7.2 Contenu scrollable (px 16) :
   - **Client** (py 12, bordure basse gray-50) : label 9 px bold gray-400 uppercase tracking-widest « Client ». Sans client choisi : champ recherche (pl 32 pr 12 py 8, fond gray-50, bordure gray-100, radius 12, texte 12 px, placeholder « Nom ou téléphone... ») avec Search 13 px gray-300 ; si saisie non vide, liste déroulante max-h 144 px sous le champ (fond blanc, bordure gray-100, radius 12, ombre 2xl, z-50) : lignes px 10 py 10, nom 12 px semibold gray-800, téléphone 10 px gray-400, fond orange-50 au survol ; tap = sélection + vide la recherche. Client choisi : carte orange-50/60 bordure orange-100/50 radius 12 padding 8 : avatar dégradé 28 px radius 8 texte 10 px bold (initiale en majuscule), nom 11 px semibold gray-800, téléphone 9 px brand ; bouton X 14 px orange-400 (padding 4) qui désélectionne.
   - **Lignes panier** : séparateur gray-50 entre lignes. Vignette 40×40 radius 12 bordure gray-100 (image de la variante sinon du produit) ; nom 11 px semibold gray-800 tronqué ; label variante 9 px gray-500 italique tronqué si présente ; prix unitaire effectif 10 px (brand semibold si prix de gros appliqué, sinon gray-400 medium) + badge « Gros » 7,5 px fond orange-100 texte brand bold px 4 uppercase si remise palier + « × » 10 px gray-300 + quantité 10 px semibold gray-600 ; contrôles −/+ : conteneur gray-50 radius 8 padding 2, boutons blancs 24×24 radius 6 ombre légère icônes Minus/Plus 10 px, compteur 11 px bold gray-800 largeur mini 19 px centré tabular-nums ; à droite total ligne 12 px bold gray-900 + bouton Trash2 11 px gray-300 (rouge au survol, title « Supprimer »). Tap − : min 1 ; tap + : refusé si stock insuffisant (toast) ; clé de ligne = `productId::variantId|base`.
   - **Panier vide** : bloc centré py 40 : carré gray-50 56 px radius 16 avec ShoppingBasket 28 px gray-200 ; « {cartWord} vide » 12 px semibold gray-300 ; « Appuyez sur un produit pour l'ajouter » 10 px gray-200.
   - **Si panier non vide** — trois blocs empilés (gap 10 px, pb 12) :
     a) label « Commande » (9 px bold gray-400 uppercase) + 2 boutons grille 2 colonnes gap 6 px : « Magasin » (Store 13 px) et « À récupérer » (Clock 13 px) ; py 8, radius 12, texte 10 px bold, bordure ; actif = fond+bordure brand, texte blanc, ombre orange-200/50 ; inactif = blanc bordure gray-100 texte gray-500.
     b) label « Paiement » + 2 boutons identiques : « Espèces » (Banknote 13 px) et « Mobile Money » (Smartphone 13 px) ; même style actif/inactif.
     c) promo : si non appliquée, rangée input (placeholder « Code promo... », texte 10 px semibold, fond gray-50, radius 12, px 12 py 6 ; Entrée valide) + bouton « OK » (px 12 py 6, fond gray-50 bordure gray-100, 10 px bold gray-500). Si appliquée : carte verte (fond green-50, bordure green-100, radius 12, px 12 py 6) : Tag 12 px + « {code} (−{pct}%) » 12 px semibold green-700, bouton X 12 px green-400 qui retire la remise.
   7.3 Pied collant (px 16 py 12, fond blanc, bordure haute gray-100, ombre haute légère) :
   - Si panier non vide : « Sous-total » 11 px gray-400 + montant 11 px semibold gray-600 tabular-nums ; si remise : ligne verte 11 px semibold « Remise ({code}) » + « −{montant} » ; puis « Total » 14 px bold gray-900 + total 20 px bold brand tabular-nums (le web : md 24 px).
   - CTA : si `permissions.canManageOrders` → bouton pleine largeur dégradé brand→#E04E0F, texte blanc 14 px bold, py 14, radius 16, ombre orange-200/40 ; contenu = Loader blanc 16 px + « Envoi... » si traitement, sinon CreditCard 18 px + libellé « Encaisser » (ou « {cartWord} vide » si panier vide) ; désactivé (gris) si panier vide ou traitement en cours.
   - Sinon : encart rouge (fond red-50, bordure red-100, texte red-500 10 px semibold centré) avec X 13 px : « Permission insuffisante ».

8. **États / interactions transverses** :
   - Filtrage produits : `searchTerm` matche nom OU `category` (casse ignorée) ; catégorie sélectionnée matche `category` ou `mainCategory` (trim) ; `all` = tout.
   - Stock : produit sans variantes = `stockMap[id] ?? product.stock` ; produit à variantes = somme des stocks variantes (si total ≤ 0 et valeur live connue, la valeur live est utilisée) ; ligne = stock de la variante si définie, sinon stock produit.
   - Ajout : quantité entière ≥ 1 ; refus si stock 0 (« Rupture de stock sur cette variante. ») ; refus si quantité déjà au panier + ajout > stock (« Stock insuffisant : N restant(s). ») ; fusion par clé produit::variante.
   - Prix unitaire ligne : prix variante (sinon prix produit) puis min(palier de gros effectif, prix de base) ; si palier < base → badge « Gros ».
   - Totaux : sous-total = Σ prix unitaire × quantité ; remise = sous-total × (pct / 100) ; total = sous-total − remise (aucune taxe/livraison).
   - Encaissement : id provisoire « CMD- » + 9 caractères aléatoires majuscules ; spinner ; délai artificiel 600 ms ; `createOrderAction(order, currentStoreId)` avec items dont le prix est le prix effectif, subtotal/total/discountAmount/promoCode/paymentMethod/customer/type (`IN_STORE` sinon `PICKUP`) et statut `COMPLETED` (magasin) / `PENDING` (à récupérer) ; succès → son de succès, modale succès, fermeture feuille, re-fetch stock, refresh routeur ; échec → toast d'erreur (muet sans `notify`, voir Points ambigus).
   - Horloge et badges stock ne bloquent jamais l'UI.

## Modales / feuilles / menus (contenu exact)

1. **Feuille panier** : détaillée en §7 (backdrop, poignée, en-tête, client, lignes, type/paiement/promo, totaux, CTA). Se ferme par backdrop ou chevron ; « Encaisser » la ferme en cas de succès.
2. **Modale succès « Vente enregistrée ! »** (après encaissement) : plein écran z-100, contenu **aligné en bas** (mobile), fond noir 50 % + flou ; panneau blanc pleine largeur, radius haut 24, max 90 vh, animation montée.
   - En-tête (p 24, centré, dégradé green-50→blanc) : poignée 40×4 px gray-200 (`md:hidden`, donc visible mobile) ; carré 64 px fond green-100 texte green-600 radius 16, CheckCircle2 36 px, animation rebond ; titre 20 px bold gray-900 « Vente enregistrée ! » ; « # » + 8 derniers caractères de l'id commande, 12 px gray-400 semibold uppercase tracking-wider.
   - Récap (px 24 pb 16) : carte gray-50 radius 16 p 16 bordure gray-100 : ligne 12 px « {totalItems} article(s) » gray-500 + sous-total semibold gray-700 ; si remise : ligne verte 12 px « Remise ({code}) » + « −{montant} » ; filet + « Total payé » 14 px bold + total 20 px bold brand ; ligne 10 px gray-400 semibold uppercase tracking-wider avec : icône Banknote/Smartphone 12 px + « Espèces »/« Mobile Money », puce « • », icône Store/Clock 12 px + « En magasin »/« À récupérer », et si client : puce + icône User 12 px + nom du client.
   - Actions (p 20 pt 8) : grille 2 colonnes gap 8 : « Imprimer » (Printer 16 px brand) et « PDF » (Download 16 px brand, remplacé par un Loader brand pendant le téléchargement, bouton désactivé) — boutons blancs bordure gray-200 radius 12 py 10 texte 12 px semibold ; puis bouton pleine largeur py 14 dégradé, texte blanc 14 px bold « Nouvelle Vente » (ferme la modale, vide panier, client, remise, remet type à `IN_STORE`, ferme la feuille).
3. **Sélecteur de paliers de gros** (mode Gros, produit multi-paliers, z-9000) : dialogue **centré** (padding 16, fond noir 40 % + flou ; tap backdrop = fermeture), carte blanche pleine largeur max 384 px radius 16.
   - En-tête (p 14, bordure basse) : vignette produit 36×36 radius 12 ; nom 14 px bold tronqué ; « Prix unitaire : {prix de base} » 10 px gray-400 ; X 16 px (aria « Fermer »).
   - Corps (p 14) : si le produit a des variantes → titre 10 px bold uppercase gray-400 « Choisir la variante · {quantité du palier} u » et une ligne par variante (px 12 py 10, radius 12, bordure) : nom 11 px bold, « SKU {sku} » 9 px gray-400, prix variante 11 px bold brand à droite, mention « Stock insuffisant » 8 px bold gray-400 si place < quantité ; lignes désactivées grisées (opacité 60 %) ; tap = ajout de la quantité du premier palier sur cette variante + fermeture.
   - Sinon → titre « Choisir la quantité gros » et une ligne par palier : pastille brand texte blanc 10 px bold px 8 py 4 radius 8 « Dès {minQty} » ; prix unitaire 11 px bold + « /u (total {prix du lot}) » 9 px gray-400 ; « Économie {montant} (-{pct}%) » 8 px bold green-600 si remise ; si ajout impossible : « Rupture » (place 0) ou « Stock insuffisant » 8 px bold gray-400 ; tap = ajout + fermeture.
   - Bouton « Annuler » pleine largeur mt 12 py 8 bordure gray-200 radius 12 texte 11 px bold gray-500.
4. **Sélecteur de variante** (produit à variantes, z-9000) : même shell centré.
   - En-tête : vignette = image de la variante sélectionnée sinon produit ; nom ; « Prix unitaire : {prix variante sélectionnée, sinon prix de base} » ; X 16.
   - Corps scrollable max 55 vh : titre « Choisir la variante » 10 px bold uppercase gray-400 ; lignes variantes (px 12 py 10, radius 12, bordure) : nom 11 px bold tronqué + SKU 9 px ; à droite prix 11 px bold brand + « {n} en stock » / « Rupture » 8 px bold uppercase (rouge si rupture, amber-600 si ≤ 5, gray-400 sinon) ; ligne rupture désactivée grisée ; variante sélectionnée = fond orange-50 bordure brand ; le tap ne fait que sélectionner.
   - CTA mt 12 pleine largeur py 10 radius 12 texte 12 px bold : « Ajouter — {prix} » si sélection avec stock > 0, sinon « Choisissez une variante » désactivé (fond gray-100 texte gray-400).
   - « Annuler » mt 6 py 8 bordure gray-200 radius 12 texte 11 px bold.
5. **Menu déroulant clients** : intégré au champ Client de la feuille panier (max 144 px, lignes nom + téléphone, tap = choisir + vider le champ). Aucun état « aucun résultat » affiché.
6. **Toasts POS** : conteneur fixe en haut (64 px du haut) à droite (12 px), z-9999, colonne gap 12 px, largeur max 90 vw, aligné à droite ; au plus 3 toasts conservés. Carte toast : fond selon type (success green-50/100, error rose-50/100, warning amber-50/100, info orange-50/100), p 16, radius 16, bordure, ombre xl, largeur max 384 px : icône 24 px (CheckCircle emerald / XCircle rose / AlertCircle amber / Info brand), titre 14 px bold + message 14 px semibold gray-600 si présents, croix de fermeture 16 px ; auto-retrait après 5 s.
7. **Pas de modale de confirmation** (vider le panier est immédiat, sans confirmation).

## Actions & données utilisées (imports @/app/actions/*, supabase, fetch, hooks paiement useKkiapay/useFedapay/useFeexpay si présents)

- `createOrderAction` (`@/app/actions/orders`, server action) : contrôle `requireStoreAccess(storeId)` ; insère la commande (storeId, customerId, date, status, paymentMethod — défaut « ESPECES » —, subtotal, total, discountAmount) puis les lignes (productId, quantity, unitPrice = prix du produit envoyé, total, variantId/Label/Sku/OptionValues) ; incrémente les ventes produits, décrémente le stock (`adjustProductStock` mode « sale », variante incluse), met à jour totalSpent/ordersCount du client, invalide caches/revalidate (`/orders`, `/pos`, `/inventory`, `/dashboard`) et notifie le propriétaire (événement `VENTE_POS`, « Vente terminée : N article(s) pour X FCFA. »). Retourne `{ success, order?, error? }`. **Le champ `type` (IN_STORE/PICKUP) n'est pas persisté** ; seul le statut diffère.
- `getStockCountsAction` (`@/app/actions/inventory`) : `{ ok, stock?: Record<productId, number>, error? }`, appelée toutes les 5 s ; mêmes contrôles d'accès.
- `supabase` (client navigateur) : table `coupons` (select * where active = true and store_id = boutique) — équivalent mobile à brancher sur l'API/le backend existant.
- `fetchStoreData` (page serveur, `@/app/actions/store`) : produits formatés (prix numbers, `wholesaleTiers`, `variants`, `mainCategory`, `businessType`), clients plafonnés à 100, store ; pas de commandes ni factures.
- Utils : `formatCurrency` (nombre plancher, milliers séparés par des espaces, suffixe « FCFA » — ex. « 12 500 FCFA »), `cartNoun` (« Panier »/« Commande »), `getNormalizedWholesaleTiers` (paliers triés, unitPrice, prix du lot, économie, % de remise), `getEffectiveWholesaleUnitPrice` (meilleur palier atteint par la quantité), `playSuccessSound` (**WebAudio, web uniquement**), `printPosReceipt` (iframe + window.print, web uniquement), `downloadPosReceiptPdf` (import dynamique jsPDF).
- Reçu (structure à reproduire si impression mobile) : ticket 80 mm, Courier New, en-tête boutique (nom majuscules, adresse, téléphone • email), blocs DATE / CMD (# + 8 derniers) / TYPE (« CLICK & COLLECT » si à récupérer, sinon « EN MAGASIN ») / PAIEMENT (« Espèces » ou « Mobile Money ») / CLIENT optionnel, tableau ARTICLE–QTE–TOTAL (variante 9 px sous le nom, quantité + unité sauf « pièce »), SOUS-TOTAL, « REMISE (code) » négative, TOTAL, pied « MERCI DE VOTRE VISITE ! ».
- Aucun `fetch` direct, aucun hook de paiement mobile-money dans le POS.

## Permissions

- UI : le bouton « Encaisser » n'apparaît que si `permissions.canManageOrders` ; sinon encart rouge « Permission insuffisante » (X 13 px). Le reste du POS (consultation produits, panier) reste accessible.
- Serveur : `createOrderAction` et `getStockCountsAction` exigent `requireStoreAccess(storeId)` (propriétaire, membre du staff, ou super-admin) → erreur « Vous n'avez pas accès à cette boutique » sinon.
- Accès à `/pos` : session vendeur requise (`canAccessSellerSpace`), sinon redirection ; `MainLayout` ne restreint que les vues settings/reports pour le rôle SELLER, pas le POS.
- Aucune garde locale (le POS ne relit jamais `permissions` ailleurs que pour le CTA).

## Exclusions desktop (md:/lg:/sm: seulement)

- Bloc nom de boutique + heure • POS : `hidden sm:block` (base masquée → absent < 640 px).
- Badge compteur produits : `hidden md:flex` → exclu.
- Colonne panier de droite : `hidden md:flex w-[360px] lg:w-[400px] xl:w-[420px]` → exclue.
- Modale succès : `md:items-center`, `md:max-w-md`, `md:rounded-3xl`, `md:zoom-in-95`, `md:duration-300` → version mobile = panneau bas pleine largeur ; la poignée est en `md:hidden` (**à garder**).
- Chevron de fermeture du panier : `md:hidden` (**à garder**).
- Toutes les variantes `md:`/`lg:`/`sm:` de tailles/espaces : md:px-5, md:py-3, md:gap-2, md:px-4 (chips), md:text-[10px], md:py-2, md:py-2.5, md:text-sm, md:w-8 md:h-8, md:text-[8px], md:text-[11px], md:p-2, md:w-11 md:h-11, md:text-xs, md:text-[10px], md:pb-4, md:gap-3, md:py-4, md:text-base, md:py-4, md:top-24, md:right-8, md:w-[18px], md:animate-in, sm:grid-cols-4 → on ne garde que la valeur de base.
- Scroll molette horizontal des catégories et masquage des barres de défilement (`no-scrollbar`, `custom-scrollbar`) : purement desktop/navigateur.

## Impact business_type (shopping vs food) s'il y en a

- `cartWord = cartNoun(businessType === 'food' ? 'food' : 'shopping')` → « Commande » en food, « Panier » sinon (tout type ≠ food = shopping).
- Utilisé exactement dans : titre de l'en-tête panier, état vide « {cartWord} vide », et libellé du CTA désactivé « {cartWord} vide ». Rien d'autre.
- La barre flottante garde « Voir le panier » même en food (texte figé).
- Le mode Gros, les paliers de gros et le bandeau « Mode gros actif » restent affichés/actifs en food (aucune garde `businessType`/`wholesaleEnabled` dans le POS), alors que le gros est « shopping only » ailleurs.
- Aucun autre écart shopping/food (mêmes catégories, mêmes statuts, mêmes paiements).

## Points ambigus / à vérifier

1. `notify` n'est jamais fourni par `page.tsx` : tous les toasts passés par `notify` (promo valide/invalide, erreurs d'encaissement, impressions, PDF) sont **muets sur le web**. Seuls fonctionnent : les toasts locaux `posToasts` (stock) et le `notify` des cartes produit (= `localNotify`). Trancher côté mobile : brancher un toast global.
2. Impression/PDF web-only (`printPosReceipt` via iframe + `window.print`, `downloadPosReceiptPdf` via jsPDF) : prévoir un équivalent RN (expo-print / partage), le contenu du ticket étant décrit plus haut. Les libellés d'erreur/succès existent déjà mais sont muets (cf. 1).
3. `key={item.product.id}` sur les lignes du panier alors que la logique est par couple produit+variante → clés dupliquées si deux variantes du même produit.
4. Barre flottante à 68 px du bas : dépend de la hauteur de la barre d'onglets vendeur web (+ safe-area) ; à recalculer en RN, avec le padding bas 112 px de la grille.
5. Comparaison de coupon sensible à la casse (`c.code === saisie.trim().toUpperCase()`) : un code stocké en minuscules ne matchera jamais ; pas de contrôle de date/quantité.
6. Caractère « − » (U+2212) dans « Remise ({code}) » et les montants négatifs du reçu : conserver le glyphe exact pour la parité.
7. Délai artificiel de 600 ms avant l'appel serveur (spinner « Envoi... ») ; le son de succès (`playSuccessSound`) est WebAudio, sans équivalent RN direct.
8. Animations web à recréer : `animate-slide-up` (feuille et modale), rebond `bounceIn` (icône succès), `animate-in` (toasts).
9. `stockOf` : produit à variantes → somme des stocks variantes ; si cette somme ≤ 0 mais qu'une valeur live existe, la valeur live est utilisée ; sinon `stockMap[id] ?? product.stock` — comportement à décider pour les badges.
10. `orderType` (IN_STORE/PICKUP) n'est pas enregistré en base : seul le statut (`COMPLETED`/`PENDING`) le reflète ; le reçu affiche « EN MAGASIN » / « CLICK & COLLECT ».
11. Les sélecteurs ne transmettent jamais `variantOptionValues` (id, nom, sku, prix seulement) → `order_items.variant_option_values` toujours `{}`.
12. Recherche : le champ texte matche nom OU `category` (jamais `mainCategory`) ; le filtre catégorie matche `category` ou `mainCategory` (trim). Écart possible de résultats.
13. Sélecteur de variante : aucune présélection, le premier tap ne sélectionne pas; le CTA ajoute 1 unité puis ferme ; le « Prix unitaire » affiché tant qu'aucune variante n'est choisie est celui du produit.
14. La grille web passe à 4 colonnes dès 640 px (`sm:grid-cols-4`) : le rendu mobile strict (< 640 px) est 3 colonnes ; trancher pour les tablettes.
15. Le POS propose 2 moyens de paiement alors que l'enum en compte 5 (CARD, BANK_TRANSFER, OTHER inutilisés) ; le reçu affiche « Mobile Money » pour tout paiement non espèces.
16. Aucun écran de chargement/skeleton produits (rendu serveur) ; seuls spinners : Encaisser (Loader blanc 16 px) et bouton PDF (Loader `sm` brand, bouton désactivé). Le badge de stock peut rester à 0 si `currentStoreId` est absent (le polling ne démarre pas).
17. La modale succès est propre au POS (pas de composant partagé) ; ne pas la confondre avec `ConfirmationModal` ou `TransactionResultModal` d'autres vues.
18. Aucun écran vendeur n'existe encore dans l'app mobile (uniquement les flux acheteur) : la coquille vendeur (tab bar, garde de session, sélection de boutique) reste à créer, avec les offsets ci-dessus.
19. Les toasts POS utilisent `top-16` (64 px) en supposant un en-tête web absent en RN : repositionner (sous la safe-area) et vérifier le maintien à l'écran avec la feuille panier ouverte (z-index 9999 vs z-60/z-100).