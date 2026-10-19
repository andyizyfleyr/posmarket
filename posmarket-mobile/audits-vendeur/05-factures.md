# Factures (Invoices) — spec mobile (parité web)

> Référence : `src/views/InvoicesView.tsx` (810 lignes) rendu à largeur < 768 px + `src/app/(app)/invoices/page.tsx` (serveur).
> Règle : classes sans variante = mobile ; `md:hidden` = mobile ; `hidden md:flex` / `hidden md:table-*` = desktop, exclues ; `sm:` ignoré. Aucune variante `lg:` n'apparaît dans la vue.

## Données attendues (props + fournit par src/app/(app)/invoices/page.tsx)

Props de `InvoicesView` (interface `InvoicesViewProps`) :
- `invoices: Invoice[]` — lignes de la table `invoices` (camelCase : `invoiceNumber`, `date`, `dueDate`, `customerName`, `customerEmail`, `customerAddress`, `subtotal`, `total`, `status`, `notes`). **Sans `items`** (table `invoice_items` séparée). Max 100 lignes, sans tri explicite.
- `onSaveInvoice?: (invoice: Invoice) => Promise<void>` — **non fourni par la page** (repli Supabase dans la vue).
- `customers: Customer[]` — déclaré mais **jamais déstructuré ni utilisé**.
- `products: Product[]` — alimente le sélecteur d'articles (nom + prix).
- `storeSettings: StoreSettings` — `name`, `address`, `phone`, `email` affichés sur la facture imprimée.
- `permissions: StaffPermissions` — seul `canManageInvoices` est lu.
- `notify?: (message, type, title?) => void` — **non fourni par la page** : sur /invoices, aucun toast ne s'affiche jamais.
- `userRole?: StaffRole` — `isSeller = userRole === 'SELLER'`.

Fourni par `src/app/(app)/invoices/page.tsx` (composant serveur) :
- Client Supabase serveur ; sans session la page rend `null` (le layout `(app)` redirige déjà vers /login).
- `getEffectiveStoreId` ; sans boutique → `NoStoreFound`.
- `fetchStoreData(storeId, undefined, { orders: false })` (action `@/app/actions/store` → Drizzle `dbFetchStoreData`) fournit `invoices`, `products` (max 200), `customers`, `store`.
- `getPermissionsForUser(supabase, user.id, storeId)` → `permissions`, `role`.
- Propage `invoices`, `products`, `customers`, `storeSettings = store?.settings`, `permissions`, `userRole = role`. Pas de `notify`, pas de `onSaveInvoice`.

Statuts possibles : `DRAFT` (Brouillon), `SENT` (Envoyée), `PAID` (Payée), `OVERDUE` (En retard). Montants via `formatCurrency` (ex. « 1 500 FCFA »).

## Structure mobile (dans l'ordre)

Chrome web mobile : sidebar `hidden md:flex` (absente) ; Navbar collante en haut (h-14) ; BottomNav mobile = Accueil, Vente, Commandes, Stocks, « Plus » (Rapports) — **aucune entrée Factures** ; le `<main>` réserve 80 px en bas (`pb-20`). La page n'est donc atteignable que par URL sur mobile web.

1. **Conteneur de page** : colonne pleine hauteur, padding 16 px, fond `bg-gray-50/30`, zone liste en `flex-grow overflow-hidden`.
2. **En-tête** : titre « Factures » 20 px bold `text-gray-900` tracking serré ; sous-titre « Gérez et générez vos factures professionnelles. » 12 px `text-gray-500`, marge haute 4 px. Bloc en colonne sur mobile, écart 16 px avant la barre d'actions.
3. **Barre d'actions** (alignée à droite, écart 8 px) :
   - Champ recherche : `hidden md:flex` → **exclu mobile** (et inerte même desktop : ni valeur ni onChange).
   - Bouton « Filtrer » : fond blanc, bordure `gray-100`, radius 12 px, px-4 py-2, ombre légère, icône `Filter` 16 px `gray-400` ; libellé « Filtrer » en `hidden sm:inline` → **icône seule** sous 768 px ; texte 12 px bold `gray-600`. **Aucun onClick** (inerte).
   - Bouton « Nouveau » (seulement si `permissions.canManageInvoices`) : fond orange brand, texte blanc 12 px bold, icône `Plus` 16 px, px-4 py-2, radius 12 px, ombre orange, `active:scale-95` ; ouvre la modale de création à l'étape 1.
4. **Carte liste** : blanche, bordure `gray-100`, radius 24 px, ombre légère, remplit la hauteur ; zone interne scrollable (`custom-scrollbar`).
5. **Ligne facture (mobile, une carte par ligne)** :
   - carte cliquable (ouvre l'aperçu), survol `bg-orange-50/30`, séparateur `divide-y divide-gray-100`, padding 12 px / 8 px (`px-3 py-2`).
   - gauche : carré 32×32 px radius 8 px fond `orange-50`, icône lucide `FileText` 16 px couleur brand.
   - numéro 11 px bold `gray-900` tronqué ; à droite du numéro, date 9 px `gray-400` semibold format fr-FR (`jj/mm/aaaa`).
   - 2e ligne 10 px : nom client (fallback « Client ») `gray-500` semibold tronqué à 100 px ; séparateur « | » `gray-200` ; total 10 px bold `gray-900`.
   - droite : pastille `p-1 rounded-lg border` avec **l'icône seule** (12 px, marge droite 4 px) puis chevron `ChevronRight` 14 px `gray-300`. Sur mobile le libellé du statut n'est **pas** affiché.
   - couleurs des statuts (fond / texte / bordure + icône) :
     - Payée : `bg-green-100 text-green-700 border-green-200`, icône `CheckCircle2` 12.
     - Envoyée : `bg-orange-100 text-[#d55a20] border-orange-200`, icône `Send` 12.
     - Brouillon : `bg-gray-100 text-gray-700 border-gray-200`, icône `FileText` 12.
     - En retard : `bg-red-100 text-red-700 border-red-200`, icône `Clock` 12.
     - Défaut : mêmes gris que Brouillon.
   - l'échéance n'apparaît pas sur mobile (ligne desktop `hidden md:block`).
6. **Aucun filtre ni recherche opérationnels** : `invoices` est affiché tel quel (pas de tri, pas de recherche, pas de filtre de statut, pas de pagination).
7. **État vide** : bloc centré padding 80 px ; rond 80 px `bg-gray-50` avec icône `FileText` 40 px `gray-300` ; titre « Aucune facture » 18 px bold `gray-900` ; texte « Créez votre première facture pour commencer. » 12 px `gray-500` ; si `canManageInvoices`, bouton orange brand px-6 py-3 radius 12 px semibold blanc avec `Plus` 18 px et libellé « Créer une facture ».
8. **Chargement** : aucun état de chargement de la liste (rendu serveur). Seul le détail d'une facture charge ses articles avec un spinner.
9. **Sélection** : tap sur une carte → modale détail ; les articles sont chargés par `fetchInvoiceItems(selectedInvoice.id)` (Supabase, table `invoice_items`) ; en attendant, `selectedInvoiceItems` part de `selectedInvoice.items || []` (vide dans la pratique).

## Modales / feuilles / menus (contenu exact, champs, validations)

### A. Modale « Nouvelle Facture » (création) — `isCreating`

Overlay plein écran `z-[100]` fond `bg-slate-900/60` + flou, centrée, padding 16 px ; panneau blanc radius 24 px, largeur max 4xl, hauteur max 95 vh, colonne.

- **En-tête** (px-6 py-4, bordure basse, collant) : titre « Nouvelle Facture » 18 px bold + icône `FileText` 20 px brand ; bouton fermer `X` 20 px `gray-400` (p-2, rond au survol).
- **Indicateur d'étapes** : 3 ronds 32 px ; atteinte = fond brand texte blanc 12 px bold, à venir = `gray-100` / `gray-400`, étape franchie = coche `Check` 14 px trait épais ; libellés 8 px bold majuscules espacées « Client », « Dates », « Articles » (orange si atteinte, sinon `gray-300`) ; trait gris 2 px + progression orange proportionnelle à `(step-1)/2 * 100 %`.
- **Corps** scrollable p-6 (24 px).
  - **Étape 1 — Informations Client** : titre « Informations Client » 10 px bold `gray-400` majuscules espacées souligné d'un filet. Champ « Nom complet ou Société » : label 10 px semibold `gray-500` majuscules, input pleine largeur fond `gray-50`, bordure `gray-200`, radius 16 px, px-5 py-4, texte 14 px semibold `gray-900`, placeholder « Ex: Jean Dupont ». Puis **une seule colonne** sur mobile : « Email » (input type email, texte 14 px normal, sans placeholder) et « Adresse » (input texte).
  - **Étape 2 — Détails & Échéances** : « Date d'émission » et « Échéance » **côte à côte** (grille 2 colonnes ; inputs date 14 px semibold ; défauts : aujourd'hui et aujourd'hui + 14 jours). Sous la grille, **1 colonne** : « Statut Initial » — select stylé avec les couleurs du statut courant, bordure 2 px, radius 16 px, px-5 py-4, texte 14 px bold ; options **Brouillon / Envoyée / Payée** uniquement (pas « En retard ») ; « Notes internes » — input texte 14 px normal, placeholder « Ex: Confiance ».
  - **Étape 3 — Articles de la facture** : ligne titre + badge « N Articles » 10 px bold brand sur fond `orange-50` arrondi.
    - Encart d'ajout (fond `gray-50/50`, radius 16 px, bordure `gray-100`, padding 16 px) : « Choisir un produit » (label 10 px semibold majuscules espacées) — select blanc radius 12 px px-4 py-3.5 texte 12 px semibold, option « Sélectionner un produit... », puis chaque produit « Nom — 1 500 FCFA » ; « Quantité » — compteur hauteur 46 px fond blanc bordé : bouton « − » (px-3, gras 18 px), input nombre centré 14 px bold (min 1, max contraint par le stock), bouton « + » ; bouton « Ajouter » **pleine largeur mobile** fond `gray-900` texte blanc 12 px bold, icône `Plus` 16 px, désactivé (opacité 30 %, grayscale) sans produit choisi.
    - Prix unitaire appliqué = prix de gros effectif selon la quantité (`getEffectiveWholesaleUnitPrice`, paliers dégressifs) ; total ligne = unitaire × quantité.
    - Contrôle stock à l'ajout : si stock > 0 et quantité > stock → alerte « Stock insuffisant pour « X » : N restant(s). » (titre « Quantité limitée »), quantité ramenée au stock, ajout annulé. (Toast invisible sur /invoices car `notify` absent.)
    - Tableau des articles (si ≥ 1) : largeur min 500 px → **défilement horizontal** ; colonnes Description / Qté (centré, 80 px) / Prix Un. (droite, 128 px) / Total (droite, 128 px) / corbeille (48 px) ; en-têtes 10 px bold majuscules `gray-400` fond `gray-50` ; quantité orange brand sur fond `orange-50/30` ; bouton `Trash2` 16 px `gray-300` (rouge au survol, p-2) retire la ligne.
    - Tableau vide : cadre pointillé 2 px radius 24 px, rond 64 px `gray-50` avec `Search` 24 px `gray-200` ; « Aucun article ajouté » 12 px bold majuscules espacées ; « Sélectionnez un produit ci-dessus pour commencer. » 10 px.
    - Totaux : bloc aligné à droite pleine largeur (carte blanche radius 24 px, bordure, padding 24 px) : « Sous-total » 10 px bold majuscules `gray-400` + montant mono `gray-900` ; « Total » 18 px bold brand (libellé 12 px majuscules) + montant mono, filet de séparation. Total = sous-total (pas de remise, pas de TVA).
- **Pied** (p-6 fond `gray-50`, bordure haute, éléments espacés) :
  - gauche : « Précédent » (étape > 1) sinon « Annuler » — px-6 py-4, bordure `gray-200`, radius 16 px, texte 14 px bold `gray-500` ; « Annuler » et la croix ferment la modale.
  - droite : « Continuer » (étapes 1-2) fond `gray-900` blanc, `flex-grow` sur mobile, px-10 py-4 radius 16 px texte 14 px bold ; étape 3 « Enregistrer la Facture » fond brand, spinner `Loader2` 16 px + libellé « Enregistrement... » pendant la sauvegarde, bouton désactivé pendant.
- **Validations à l'enregistrement** : nom client obligatoire → message « Entrez le nom du client. » + retour étape 1 ; au moins un article → message « Ajoutez au moins un article. » + retour étape 3. Sur /invoices, ces messages sont silencieux (`notify` non branché).
- **Effet de l'enregistrement** : génère le numéro « FAC-{AAAA}{MM}-{0000} » (compteur = nombre de factures + 1, 4 chiffres), id temporaire `temp-{timestamp}`, `customerName` fallback « Client », email/adresse fallback vides, statut du formulaire (défaut Brouillon). Succès → fermeture, remise à l'étape 1, formulaire réinitialisé (date du jour, échéance +14 j, aucun article). Échec → seul un message « Erreur lors de l'enregistrement de la facture » (invisible ici). La fermeture par croix **ne réinitialise pas** les champs (ils persistent à la réouverture, seule l'étape repasse à 1).

### B. Modale « Détail & PDF » (facture sélectionnée) — `selectedInvoice && !isCreating`

Overlay plein écran `z-[100]` fond `bg-slate-900/60` + flou, padding 8 px mobile ; panneau blanc radius 24 px, hauteur max 90 vh, **colonne** sur mobile (2 colonnes seulement ≥ md).

- **En-tête mobile collant** (`md:hidden`, p-3, bordure basse, fond blanc) : numéro de facture 14 px bold `gray-900` ; statut 9 px semibold majuscules `gray-400` (« Brouillon » / « Envoyée » / « Payée » / « En retard ») ; bouton `X` 20 px `gray-400` (p-2, `-mr-2`) ferme la modale.
- **Aperçu facture** (zone scrollable, fond `gray-50/50`, padding 8 px) : document blanc centré `w-full`, largeur max 800 px, radius 12 px, bordure `gray-100`, ombre forte, padding 24 px, hauteur min 500 px, filet orange 8 px en haut. Contenu dans l'ordre :
  - titre « FACTURE » 24 px bold majuscules tracking serré ;
  - bloc méta 10 px `gray-500` : « NUMÉRO : » (label 10 px semibold `gray-400` majuscules, largeur 80 px) + numéro en police mono semibold `gray-900` ; « DATE : » + date fr-FR ; « ÉCHÉANCE : » + date fr-FR ;
  - bloc boutique aligné à gauche (encadré `bg-gray-50` radius 12 px, padding 16 px) : nom boutique 14 px bold brand (fallback « Boutique ») ; adresse `gray-500` (retours ligne conservés) ; téléphone `gray-700` semibold ; email `gray-500` ;
  - bloc client (encadré `gray-50/50` radius 12 px bordé) : titre « CLIENT » 8 px bold `gray-400` majuscules souligné ; nom 16 px bold ; adresse 12 px `gray-600` italique (si présente) ; email 12 px brand semibold (si présent) ;
  - tableau articles : largeur min 500 px → **défilement horizontal** ; en-têtes 10 px bold `gray-900` majuscules sur filet noir 2 px : Description / Qté (centré, 64 px) / Prix Un. (droite, 96 px) / Total (droite, 96 px) ; lignes 12 px séparées par `gray-100` : description semibold `gray-800`, quantité centrée `gray-600`, prix unitaire droite `gray-600`, total droite bold `gray-900` ;
  - pendant le chargement : spinner `Loader2` orange 24 px centré (remplace le tableau) ;
  - totaux alignés à droite : « SOUS-TOTAL » 12 px `gray-500` + montant mono ; « TOTAL » 16 px bold brand au-dessus d'un filet noir 2 px + montant mono (valeurs `selectedInvoice.subtotal` / `.total`, non recalculées) ;
  - si notes : « CONDITIONS & NOTES » 10 px bold `gray-400` majuscules + texte 14 px `gray-600` (retours ligne conservés) ;
  - pied d'aperçu 12 px `gray-400` centré : « Merci pour votre confiance. En cas de question concernant cette facture, merci de nous contacter. »
- **Panneau d'actions bas** (pleine largeur mobile, bordure haute, padding 16 px, collé en bas, `shrink-0`) :
  - si **non vendeur** : label « Statut » 10 px semibold `gray-400` majuscules ; select pleine largeur 12 px bold, bordure 2 px radius 12 px px-4 py-2.5, couleurs du statut ; options **Brouillon / Envoyée / Payée / En retard**. Changement → sauvegarde (`onSaveInvoice` sinon `invoices.update` Supabase), toast « Statut de la facture mis à jour » ou « Erreur lors de la mise à jour », `router.refresh()`, statut mis à jour dans la modale. Si vendeur : select **masqué** (statut non modifiable).
  - deux boutons **côte à côte**, chacun `flex-grow` : « Imprimer » (fond blanc, bordure 2 px `gray-100`, radius 12 px, py-2.5, texte 11 px bold `gray-600`, icône `Printer` 16 px) et « PDF » (fond brand, blanc, texte 11 px bold, icône `Download` 16 px ; pendant l'export : spinner `Loader2` + « Génération... », bouton désactivé).
  - bouton « Email » **exclu mobile** (`hidden md:flex`) — et sans handler même sur desktop.
- Aucune action « Modifier », « Envoyer », « Supprimer » ni « WhatsApp » dans cette modale.

## Actions & données utilisées (imports @/app/actions/*, supabase, fetch, receipt/print)

- Page serveur : `@/app/actions/store` `fetchStoreData` (Drizzle `dbFetchStoreData`, factures `limit(100)` sans `orderBy`), `@/utils/store-cookie` `getEffectiveStoreId`, `@/utils/permissions` `getPermissionsForUser`, client `@/utils/supabase/server`, composant `NoStoreFound`.
- Vue : client Supabase navigateur `@/supabase` pour `invoices.upsert` / `invoices.update({status})` et la lecture `invoice_items` ; `fetchInvoiceItems` de `src/hooks/useSupabaseData.ts` (select * où `invoice_id`) appelé à chaque sélection ; `useRouter` (`next/navigation`) pour `router.refresh()`.
- Formatage : `formatCurrency` de `@/utils` (arrondi bas, milliers séparés par espaces, suffixe « FCFA ») ; `getEffectiveWholesaleUnitPrice` de `@/utils/wholesale`.
- **Imprimer** : `handlePrint` remplace temporairement `document.title` par le nom de la boutique, appelle `window.print()`, puis restaure le titre. **Aucune modale ni aperçu dédié** : c'est le dialogue d'impression du navigateur (Chrome Android : impression / « Enregistrer en PDF » ; Safari iOS : feuille d'impression du système). Dans un WebView intégré, `window.print()` peut ne rien faire. CSS print global (`globals.css`) : tout enfant direct du `body` sans `print-only` est masqué, `#invoice-print` forcé à 210 mm.
- **PDF** : export 100 % client — `html2canvas` du nœud `#invoice-print` (échelle 2, fond blanc, clone forcé à 794 px avec padding 60 px, CORS activé) puis `jsPDF` A4 portrait, image sur 210 mm de large, découpage sur plusieurs pages si dépassement ; fichier « Facture-{numéro|id}.pdf ». Échec → « Erreur lors de la génération du PDF » (toast invisible ici). html2canvas/jsPDF n'existent pas en React Native : prévoir une alternative (expo-print / partage de fichier).
- `@/utils/receipt.ts` **n'est pas utilisé par les factures** : `printPosReceipt` / `downloadPosReceiptPdf` servent uniquement les tickets de caisse 80 mm de `POSView`.
- Aucun `fetch`, aucune API, aucune intégration WhatsApp. Il existe pourtant un `saveInvoice(invoice, storeId)` complet dans `src/supabase-api.ts` (gère l'id `temp-`, insère la facture puis ses `invoice_items`) mais il **n'est pas branché** sur la page.

## Permissions

- `permissions.canManageInvoices` : conditionne le bouton « Nouveau » et le bouton « Créer une facture » de l'état vide. Aucun autre point d'entrée de création.
- `userRole === 'SELLER'` : masque le select « Statut » de la modale détail (impression et PDF restent possibles).
- Attribution (`getPermissionsForUser`) : propriétaire de la boutique ou super-admin → toutes permissions (dont factures) ; membre du staff → permissions stockées (peut être refusé) ; rôle SELLER sans fiche staff → objet vide (aucune gestion de factures).
- La page n'a pas de garde de rôle propre ; l'entrée « Factures » est absente de la navigation mobile (BottomNav et menu « Plus »), elle n'existe que dans la sidebar desktop.

## Exclusions desktop (md:/lg: seulement)

- Champ de recherche `hidden md:flex` ; libellé « Filtrer » `hidden sm:inline`.
- Liste : en-tête tableau `hidden md:table-header-group` (Numéro, Date, Client, Statut, Montant, Actions) ; cellules Date, Client, pastille avec libellé, Montant, bouton chevron `hidden md:table-cell` ; structure `md:table-row` / `md:table-cell` ; échéance sous le numéro `hidden md:block`.
- Modale détail : croix absolue en haut à droite, titre « Actions », bouton « Email », colonne latérale 320 px (`md:w-80`), disposition `md:flex-row`, bordures `md:border-l` / `md:border-t-0`, paddings `md:p-8` / `md:p-6`.
- Modale création : titre `md:text-xl`, croix `md:size-6`, corps `md:p-8`, rangée produit `md:flex-row`, quantité `md:w-36`, bouton « Ajouter » `md:w-auto`, tableau `md:min-w-0` et radius `md:rounded-2xl`, totaux `md:w-80`, boutons de pied `md:flex-none`, grilles `md:grid-cols-2`.
- Aperçu facture : padding `md:p-12`, radius 0, bordure `md:border-gray-200`, ombre légère, tailles typo `md:text-*` (14 px, 20 px, 24 px, 36 px) et largeurs de colonnes doublées.
- Aucun bloc `lg:` à prendre en compte dans cette vue.

## Points ambigus / à vérifier

1. `notify` et `onSaveInvoice` ne sont pas fournis par la page : aucun toast (validations, stock, statut, erreur PDF/enregistrement) ne s'affiche sur /invoices. À trancher pour l'app (reproduire le silence ou brancher les toasts).
2. Création non fonctionnelle en l'état : repli `supabase.from('invoices').upsert` avec un id `temp-...` (non UUID) et `store_id` lu sur une clé inexistante (`invoices[0].store_id` alors que les lignes arrivent en camelCase). L'échec n'est que journalisé. Le bon chemin (`saveInvoice` de `src/supabase-api.ts`) doit être repris côté mobile.
3. « Filtrer » et le champ de recherche sont inertes (aucun état). Parité stricte = les garder inertes ou les implémenter fonctionnellement (décision produit).
4. `customers` est passé mais inutilisé : pas de sélection d'un client existant, uniquement de la saisie libre.
5. Tri/pagination absents : ordre d'insertion probable, limite 100 factures.
6. Données : `date`/`dueDate` peuvent arriver en ISO ou `Date` sérialisé ; `subtotal`/`total` sont des `numeric` → chaînes possibles (à normaliser avant `formatCurrency`). `items` n'est jamais fourni par la jointure.
7. Impression/PDF web only : `window.print()` et html2canvas/jsPDF n'ont pas d'équivalent direct en natif ; l'app devra passer par expo-print / partage (le rendu visuel doit rester identique).
8. Pas d'édition d'une facture existante, pas d'envoi réel par email, pas de suppression, pas de WhatsApp, pas de bouton « marquer payée » dédié (uniquement le select de statut, y compris Payée).
9. La modale de création conserve les champs à la fermeture (pas de reset) — à reproduire ou corriger selon la décision.
10. Statut affiché en icône seule sur la ligne mobile : ne pas oublier le libellé dans l'en-tête de la modale détail (9 px). Couleur « Envoyée » = orange brand `#d55a20` (pas bleu, contrairement à la page admin PAM).
11. Écritures directes avec le client Supabase public (RLS) : côté natif il faudra des routes/actions autorisées équivalentes.
