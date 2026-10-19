# AUDIT DE PARITÉ — App mobile ↔ Vitrine web (rendu mobile)

> Référence = le rendu **web à largeur mobile** (c'est le design à copier).
> Règle : chaque section/élément du web doit exister dans l'app **à l'identique** ; aucun élément inventé ne doit rester.
>
> Fichiers de référence web :
> - `src/views/StorefrontView.tsx` — home, catégories, boutique, recherche, feuille « Voir tout », header, barre panier
> - `src/views/storefront/ProductDetailsView.tsx` — fiche produit
> - `src/views/storefront/CartCheckoutView.tsx` — panier + checkout (3 étapes)
> - `src/views/BuyerView.tsx` + `src/components/buyer/*` — mon compte
> - `src/components/ProductCard.tsx`, `src/components/BottomSheet.tsx`, `src/components/MarketplaceFooter.tsx`

---

## 0. Chrome de navigation

### Web mobile
- **Aucune barre d'onglets en bas.**
- Header collant uniquement sur `/` : logo (h-7) à gauche ; à droite **2 boutons 44×44** (bg-gray-50, radius 16) : **Panier** (icône 20, badge orange 20 px en haut à droite) et **Compte** (icône 28×28). Pas de texte.
- Barre de recherche mobile sous le logo : « **Je cherche...** » (texte 11 px), hauteur ~36 px, radius 12, bordure 1,5 px ; **se replie au scroll** (headerCompact). Au tap → **overlay de recherche plein écran**.
- Pas de rangée de chips catégories sur mobile (desktop uniquement).
- **Barre fixe en bas** quand le panier n'est pas vide : bandeau blanc + filet, pilule orange pleine largeur h-48 « **Voir mon panier • {total}** » (icône panier + badge compteur noir). Le footer réserve 80 px pour elle.
- Toast « Ajouté au panier » (carte blanche, image 48, titre vert + nom + prix) en haut à droite.

### App actuelle
- 4 onglets bas : Accueil, Catégories, Panier, Compte.
- Header home : logo 30 px + **badge orange « nombre de boutiques » (inventé)** ; recherche 46 px, texte 15 px, placeholder « Chercher un produit, une boutique... » (place-holder de l'overlay web, pas de la barre mobile).
- **Rangée de chips catégories avec emojis (inventée)** : « Tout (N) », « 📦 Catégorie (N) ».
- Pas de barre panier fixe sur la home. Pas de toast d'ajout global.
- Onglet **Catégories = page inventée** (liste avec emojis, tap = `router.push('/(tabs)')` → ne filtre même pas).

### À faire / arbitrer
1. Header home = logo + **Panier (badge) + Compte** (boutons 44×44), supprimer le badge boutiques.
2. Recherche « Je cherche... » compacte, repliable au scroll.
3. **Décision** : garder les 4 onglets bas, ou retirer la barre d'onglets pour coller au web (header panier/compte + barre « Voir mon panier ») ?
4. **Décision** : onglet Catégories (n'existe pas côté web) — supprimer, ou le transformer en liste de catégories cliquable qui filtre la home ?
5. Ajouter la **barre « Voir mon panier • total »** sur la home (et espacer le footer en conséquence).
6. Ajouter le **toast d'ajout au panier** (style web) partagé.

---

## 1. Accueil — `app/(tabs)/index.tsx`

### Web mobile (dans l'ordre)
1. Header (voir §0).
2. **Hero** : 3 affiches mobiles (720×560), défilement auto, liens `/login`, `/login`, `/products/wholesale`. Cadre radius 24, bordure orange clair.
3. **Boutiques partenaires** : titre 15 px bold + badge compteur (max 6) ; carrousel horizontal de cartes 120 px (largeur (100vw−42)/2) : logo 32 rond bordure orange, nom 11 px bold + pastille bleue vérifiée, note (étoile orange) ou « Nouveau », « • N produits ». Clic → boutique.
4. **Sections par catégorie** (tout le catalogue) : titre 14 px bold (+ tag « Restauration » si food) + « Voir tout » 11 px orange + chevron ; grille 2 colonnes, **6 produits** par section (ProductCard).
   - « Voir tout » **sur mobile ouvre une feuille bas d'écran** (BottomSheet) : nom catégorie, « N produits », grille 2 col de **tous** les produits de la catégorie, bouton fermer, glisser vers le bas pour fermer. (Sur desktop il navigue vers /category.)
5. **Overlay recherche** (si recherche) : voir §6.
6. **Footer** : logo 32 px + « Place de marché reliant les vendeurs et les acheteurs. » + « LÉGAL » (Guide d'utilisation, CGV, Politique de confidentialité) + « NOS ENGAGEMENTS » (Paiement sécurisé vert, Commerçants locaux vérifiés orange) + filet + © + « Prix affichés en FCFA (XOF) ».
7. Barre « Voir mon panier » (§0) + toasts.

### App actuelle
- Header avec badge boutiques (inventé) + chips (inventées).
- Hero ✅ (mêmes affiches, mêmes liens navigateur, auto-défilement, snap).
- Partenaires ✅ (structure fidèle).
- Sections ✅ sauf « Voir tout » qui **filtre la page** (le web ouvre une feuille), et grille sans le badge « -X% » web exact (voir §7 ProductCard).
- Recherche : résultats **en ligne dans la home** (« Boutiques trouvées (N) » + « Résultats produits ») — proche du contenu web mais sans overlay/récentes/populaires/suggestions.
- Footer ✅ (logo 26 px au lieu de 32, tagline 13 px au lieu de 14).
- Manquants : barre panier fixe, toast d'ajout, feuille « Voir tout ».

---

## 2. Fiche produit — `app/product/[slug].tsx`

### Web mobile (dans l'ordre) — ProductDetailsView.tsx
1. **Barre haute collante** : nom de boutique centré (15 px bold, 2 lignes max, cliquable → boutique) + petit trait orange 3×28 dessous. Pas de bouton partage.
2. **Galerie pleine largeur** (bord à bord, carrée 1:1) : scroll-snap ; **points** dans une pilule blanche translucide (actif 16 px orange, inactif 6 px gris) ; badge **« -X% »** rouge en haut à gauche (éclair) ; badge food **« Fraîchement préparé · {délai} »** (vert) ; **compteur « n/N »** en bas à droite. Tap → zoom plein écran.
3. **Carte info** :
   - **Vendeur** : logo 36 rond + « Vendu par » (10 px gris) + nom boutique (13 px semibold) + coche + **catégorie cliquable** (11 px + chevron) → home filtrée sur la catégorie.
   - Titre produit **17 px bold**.
   - **Preuve sociale** : 5 étoiles 12 px + note + « (N avis) » + « · N vendus » (ou « N commandes » en food) + « · N vues ».
   - **Prix** : bloc gris radius 12 : label « PRIX »/« DÈS » 10 px + prix **22 px bold** + « /{unité} » + prix barré + badge vert « -X% Éco ».
   - **Stock + délais** : « N en stock » (vert) / « Plus que N disponibles » (ambre) / « Rupture de stock » (rouge) / « Combinaison indisponible » ; + « Préparation {x} » (vert) et « Livraison {x} » (bleu, camion) en food retombe sur livraison.
   - **Prix de gros** (jamais en food) : accordéon ambre « PRIX DE GROS » + « Dégressif » ; lignes « Qté Min : N pièces • Prix total : X F » (+ « -X% »), bouton « Ajouter » (noir, devient vert ✓), « stock bas » rouge si insuffisant ; lien WhatsApp « Négocier sur WhatsApp ».
4. **Carte description** : titre « DÉTAILS DU PLAT » (food) / « DESCRIPTION PRODUIT » (11 px uppercase + barre orange) ; description enrichie (paragraphes, listes, gras) + mises en avant auto + badges auto + **grille specs 2 col** (catégorie, boutique, stock…) ; repli à 128 px avec fondu + « **Lire la suite** » / « Réduire ».
5. **Section Avis** (carte) : titre « AVIS SUR LE PRODUIT / SUR LE REPAS » ; résumé note /5 + étoiles + « N notes et avis » ; **distribution 5→1** (barres jaunes + %) ; mobile = **3 avis** puis bouton « Voir les N autres avis » → **feuille bas d'écran** (poignée, « N avis », « Sur le produit · X/5 », liste complète). Carte avis : avatar (dégradé, initiale) ou photo, **nom masqué**, étoiles, date fr, « Avis vérifié » vert, commentaire, **réponse vendeur** (bordure orange + « RÉPONSE DU VENDEUR »). Vide : carte pointillée « Aucun avis rédigé » + invitation.
6. **« Dans la même boutique »** : titre uppercase + carrousel horizontal de ProductCard (145-160 px) — **8 produits** de la même boutique (même catégorie d'abord).
7. **Barre d'action fixe basse** :
   - sélection déjà au panier → bouton noir pleine largeur « Voir mon panier » + badge compteur orange ;
   - sinon bouton orange pleine largeur (« Ajouter au panier » / « Choisir les options » / « Commander » food / « Commander direct » food / « Rupture ») + **bouton rond noir panier avec badge** si panier non vide.
   - **Pas de total affiché** dans la barre.
8. **Feuille options** (bottom sheet) : rappel « Sélection : Option: valeur × » ; groupes d'options en **chips** (min 44 px, actif orange + coche, indisponible barré) ; **nuancier** pour les options couleur (pastilles rondes 40 px + code hex) ; indices (« Sélectionnez les options pour commander » ambre, « combinaison indisponible » rouge, stock variante vert).
9. Toasts globaux.

### App actuelle
Top bar avec **bouton partage (inventé)** ; galerie 320 px (pas pleine largeur, pas de badges remise/food/compteur) ; carte : lien boutique simple (pas de logo/catégorie), titre, note, « N ventes », badge stock vert, prix orange 24 px (le web : prix noir 22 px sur fond gris), **tarifs de gros en cartes (design non conforme)**, **variantes en chips plates (le web : feuille options)**, **sélecteur de quantité (inventé)**, description brute sans replis/mises en avant/specs, **3 badges de confiance en ligne (le web : « Paiement sécurisé · Retour 7 jours » / food « Fait minute · Fraîcheur »)**, avis simples (auteur non masqué, pas de date/distribution/réponse/« voir plus »), similaires 6, **barre basse avec Total + « Ajouter » + « Commander »** (non conforme), toast orange « Produit ajouté au panier ! » (non conforme).

### Correctifs
- Supprimer : partage, quantité, blocs gros/variantes actuels, badges confiance actuels, total dans la barre, toast orange.
- Ajouter/refaire : topbar boutique + trait, galerie bord à bord + badges + compteur, vendeur avec logo + catégorie, preuve sociale complète, bloc prix conforme, stock+délais, accordéon gros conforme, description enrichie + « Lire la suite », section avis complète + feuille, similaires 8, feuille options, barre CTA conforme (labels dynamiques + « Voir mon panier »), toast web.

---

## 3. Boutique — `app/store/[slug].tsx`

### Web mobile
1. Bande **cover** 56 px dégradé orange → orange clair.
2. Carte boutique : **logo 48** centré qui chevauche le cover (ring blanc) ; nom (16 px bold) + **coche verte** ; ligne note : étoile jaune + note orange bold + « (N avis) » + « · N produits en ligne » ; **adresse** (MapPin orange/70) ; description centrée 11 px ; bouton **WhatsApp** h-40 pilule bordée (icône verte).
3. **Bandeau statistiques** 3 colonnes séparées : « N **Produits** » / « N **Visiteurs** » / « X.X/5 **Note** » (labels 8 px uppercase).
4. **Onglets « Produits » / « Avis »** : segmented (actif = pilule blanche ombrée, inactif gris).
5. Onglet Produits : champ **« Chercher dans cette boutique... »** ; quand une catégorie interne est choisie : en-tête (chevron rond 36 + nom + « N produits ») ; sections par catégorie + « Voir tout » (→ feuille sur mobile) ; grille 2 col ; chargement infini (spinner + « Chargement des produits... ») ; vide : carte pointillée « Aucun produit dans cette sélection ».
6. Onglet Avis : carte résumé (note grande + étoiles + « N avis » + distribution 5→1) ; liste d'avis (avatar, nom masqué, étoiles, date, « Avis vérifié », commentaire, réponse vendeur, **carte produit « Voir le produit »** avec vignette) ; bouton noir « Voir plus d'avis (N) » ; vide : « Aucun avis pour le moment ».

### App actuelle
Top bar simple ; carte boutique (logo 56, nom, adresse, téléphone, description, « N produits ») ; **chips de catégories (inventées**) ; titre « Catalogue (N) » (inventé) ; grille 2 col ; **pas d'onglets Produits/Avis, pas de cover dégradé, pas de stats, pas de WhatsApp, pas de recherche interne, pas de chargement infini, pas d'avis**.

### Correctifs
Refaire la page selon la structure ci-dessus (cover, carte centrée, stats, onglets, recherche interne, en-tâtes catégorie + feuille, avis).

---

## 4. Panier & Checkout — `app/(tabs)/cart.tsx` + `app/checkout.tsx`

### Web mobile (une seule vue à 3 étapes) — CartCheckoutView.tsx
1. **En-tête** : icône + titre (« Mon Panier » / « Livraison » / « Paiement » / « Commande Validée ») + badge compteur d'articles + bouton « ← Continuer les achats ».
2. **Indicateur d'étapes** (hors succès) : 3 ronds (Panier, Livraison, Paiement) — actif orange, passé vert ✓, connecteurs soulignés en orange.
3. **Étape Panier** :
   - pilule de réassurance « Paiement sécurisé · Payez à la livraison » (uppercase 9 px).
   - **Cartes par boutique** : en-tête (icône Store + nom + « N articles ») ; lignes article : vignette 64 radius 12, nom cliquable, pastille variante (ou « prix de gros appliqué »), compteur −/+ et prix ; **suppression par glissement** (révèle bouton rouge « Retirer ») + corbeille ; alerte si minimum de commande B2B non atteint ; bouton « Voir tout (N) » / « Réduire » si > 3 articles.
   - **Code promo** : bouton pointillé « Ajouter un code promo » → champ + bouton ✓ ; appliqué : bandeau vert « Code X appliqué » + croix.
   - **Récapitulatif** : Sous-total · N articles, « Économies prix de gros » (vert), « Code X » (vert), **Total** orange bold.
   - CTA « **Passer à la livraison** » (pleine largeur, flèche).
4. **Étape Livraison** : carte « **1 — CONTACT À LIVRER** » : Nom Complet + Téléphone mobile (sélecteur pays/format, validation). **Pas d'adresse/ville demandées.** CTA « Passer au paiement » + lien « ← Retour à l'étape précédente ».
5. **Étape Paiement** : une seule option « **Paiement à la livraison** » (camion, bordure orange si sélectionné). CTA « Confirmer la commande » (spinner).
6. **Barre fixe mobile** : Total + CTA de l'étape courante.
7. **Succès** : cercle vert (✓ 48) + étoile jaune, « Commande **Réussie !** », trait vert, message « Votre commande a été enregistrée avec succès. Le vendeur va traiter votre commande rapidement. », boutons « Accueil » + « **WhatsApp** » (si une seule boutique avec téléphone → ouvre WhatsApp avec le récap de commande).
8. **Panier vide** : icône dans carte blanche, « Votre panier est vide », « Parcourez les boutiques et ajoutez vos produits favoris. », bouton « Découvrir la boutique ».
9. Libellés dynamiques : **« Panier » (shopping) / « Commande » (food)** (`cartNoun`).

### App actuelle
- `cart.tsx` : liste plate (pas de regroupement boutiques), compteurs ±, corbeille + Alert natif, total + « Commander ». **Pas d'étapes, pas de réassurance, pas de promo, pas de swipe, pas de min B2B.**
- `checkout.tsx` : sections « 1. Informations de livraison » (nom, téléphone, **adresse, ville — le web ne les demande pas**), « 2. Mode de paiement » avec **3 options (Wave, Orange Money, espèces) — inventé : le web n'a que « Paiement à la livraison »**, « 3. Récapitulatif », modale succès.

### Correctifs
- Fusionner panier et checkout en **une vue à 3 étapes** (ou au minimum reproduire étapes + en-têtes + indicateur).
- Supprimer Wave/OM et les champs adresse/ville ; ne garder que nom + téléphone.
- Ajouter réassurance, regroupement par boutique, promo, swipe, min B2B, écran succès web (boutons Accueil/WhatsApp).
- Libellés Panier/Commande selon verticale.

---

## 5. Compte acheteur — `app/(tabs)/account.tsx`

### Web mobile — BuyerView.tsx
1. **En-tête collant** : flèche retour, « Mon compte », bouton **rafraîchir** (spinner en rotation pendant la synchro).
2. **Carte identité** : avatar (dégradé orange, initiale ou photo), nom, e-mail, statut « Synchronisation… » ; **stats** : Commandes / Avis / Adresses séparées par filets.
3. **Tuiles d'onglets** (mobile, grille 3) : Commandes, Avis, Profil (actif = fond orange clair + bordure).
4. Titre de section + description sous les tuiles.
5. **Commandes** : cartes — en-tête (icône colis orange, « #XXXXXX • date », nom boutique, **badge statut** : Livré vert / En cours bleu / Commandé ambre / Annulé rouge) ; lignes article (vignette 48, nom cliquable, « 2 × 1 500 F », **bouton étoile orange → modale d'avis**) ; pied gris « TOTAL » + montant ; bouton « **Afficher plus** ». Vide : « Aucune commande pour le moment » + bouton « Découvrir les boutiques ».
6. **Avis** : cartes (vignette + nom boutique orange + produit + étoiles + date + citation grise) ; vide : « Aucun avis publié ».
7. **Profil** : carte (avatar + nom + « Membre Marketplace ») ; photo de profil (choisir/retirer, JPEG/PNG ≤ 2 Mo) ; nom d'affichage ; e-mail (lecture seule) ; téléphone ; bouton « **Enregistrer mes informations** » ; carte séparée « **Me déconnecter** » (rouge) + modale de confirmation.
8. Onglets **« Livraison » (adresses)** et **« Alertes » (notifications)** masqués de la nav mais accessibles (URL) : adresses = cartes avec icône (Maison/Bureau/MapPin), « Par défaut », modifier/supprimer + modales ; alertes = préférences WhatsApp/e-mail par événement + historique.
9. Modales : ajout/édition d'adresse, avis produit, déconnexion, confirmation suppression.

### App actuelle
Carte profil (identité e-mail/téléphone locale), bouton « Modifier » → formulaire, onglets **Commandes / Adresses** (2 boutons), commandes simples (statut, lignes, total), adresses (ajout/suppression, modales). **Pas d'avatar, pas de stats, pas de tuiles Avis/Profil, pas d'onglet Avis, pas de profil éditable (nom/photo/mot de passe), pas de déconnexion, pas d'alertes.**

### Note importante
Le web utilise une **session authentifiée** (lien magique) ; l'app utilise un e-mail/téléphone local. La mise en page doit suivre le web ; le mécanisme de données peut rester celui de l'app.

### Correctifs
Refaire la mise en page (identité + stats, tuiles Commandes/Avis/Profil, titre de section, cartes commandes avec étoile d'avis + « Afficher plus », avis, profil avec photo/nom/téléphone/enregistrer/déconnexion).

---

## 6. Recherche & catégories

### Web mobile
- **Overlay plein écran** (au tap de la recherche) : bouton retour, champ « Chercher un produit, une boutique... » (avec croix), **suggestions** au fil de la frappe (nom + catégorie) ; résultats : « **Boutiques (N)** » (grille 2 col : logo 56 rond, nom, « N PROD. », « @slug ») puis « **Produits (N)** » (grille 2 col) ; indicateur « Recherche … » à points animés ; état vide dédié.
- Sans saisie : « **Recherches récentes** » (puces + « Effacer », localStorage) et « **Recherches Populaires** » (iPhone, Samsung, Mode, Sneakers, Parfums, High-Tech).
- **Catégorie** (page `/category/[slug]` ou `?cat=`) : en-tête retour (chevron rond 36) + nom + « N produits », puis grille complète 2 col.

### App actuelle
- Recherche **inline** dans la home (pas d'overlay) : « Boutiques trouvées (N) » + « Résultats produits » ; pas de suggestions/récentes/populaires.
- **Onglet Catégories inventé** (liste emojis, tap inopérant).

### Correctifs
- Créer l'**overlay de recherche** (écran ou modale) conforme : récentes (AsyncStorage), populaires, suggestions, résultats.
- Catégories : voir §0 (décision onglet) ; l'en-tête catégorie filtrée existe déjà (conforme).

---

## 7. Éléments transverses

### ProductCard (web) vs app
- Web : **pas de nom de boutique, pas de note** ; nom produit **9 px sur 1 ligne** (`line-clamp-1`) ; prix 10 px noir + prix barré 8 px ; ligne « **N ventes** » (9 px) à gauche + « **N vues** » (9 px + œil 10) à droite ; badge « -X% » 8 px ; bouton « Ajouter » min 36 px, texte 9 px, gris clair (devient orange à l'appui), Plus 12 ; « Choisir » si options ; « Rupture » grisé dans le bouton ; **pas d'overlay sur l'image**.
- App : ajoute un nom de boutique (9) + une ligne note/étoile/avis (10/9) — inventés ; nom 12 px sur 2 lignes ; prix 13 px ; bouton 32 px texte 11 px ; overlay noir « Rupture » sur l'image (absent du web).
- → À ramener au modèle web : retirer boutique/note/overlay, ajouter ventes/vues, nom sur 1 ligne, tailles web.

### Bottom sheet (web)
- Poignée grise 40×4, titre 14 px bold centré, bouton fermer rond gris 32 px à droite, sous-titre 11 px gris centré, corps scrollable, radius haut 24, fond noir 50 %.

### Toasts / notifications web
- « Ajouté au panier » : carte blanche (radius 16, ombre), vignette 48, titre vert 12 px gras + nom produit 12 px + prix orange, fermeture auto 4 s.
- Alertes stock : ambre, même gabarit.

### Libellés dynamiques
- « Panier/panier » (shopping) vs « Commande/commande » (food) — `cartNoun`/`cartNounLower`. L'app écrit « Panier » partout.

---

## 8. Fonctionnalités web sans équivalent app (à arbitrer)

1. **Page `/products/wholesale`** (affiche vente en gros) + modale « **Commande rapide** » + bandeau gros dégressif : atteignables sur le web ; l'app ouvre le navigateur pour l'affiche n° 3. Rien dans l'app.
2. **Overlay recherche** complet (récentes/populaires/suggestions) — voir §6.
3. **Modale de connexion acheteur** (lien magique par e-mail) — l'app n'a pas de session.
4. Onglets cachés du compte **« Livraison » / « Alertes »**.
5. **Garde-fou pays** du checkout (« Commande indisponible »).
6. Bandeau d'installation PWA — sans objet en natif.
