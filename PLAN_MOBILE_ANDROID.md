# Plan d'implémentation — Application Mobile Android (React Native / Expo)

Guide complet pour créer l'application mobile Android PosMarket en restant fidèle à l'architecture, au design system, aux API et aux règles métier de ce projet.

---

## 1. Principes Directeurs & Contrats Métier

- **Verticales supportées** : Uniquement **`shopping`** et **`food`** (aucun type `stay` ou `digital` selon les règles du projet).
- **Consommation API** : L'application mobile consomme les routes existantes de PosMarket sous `/api/*` et s'authentifie auprès du même backend.
- **Cache client acheteur** : Utilisation de la clé `buyer_data_cache_v2` pour la persistance locale de l'espace acheteur.
- **Modales natives** : Pas de `window.confirm` ou alertes brutes ; les confirmations utilisent des modales React Native stylisées.

---

## 2. Stack Technique Recommandée

| Domaine | Outil / Bibliothèque | Rôle dans l'application |
|---|---|---|
| **Framework** | **React Native (via Expo SDK)** | Base mobile native Android performante et maintenable |
| **Routage** | **Expo Router** | Routage par fichiers identique aux conventions Next.js (`app/`) |
| **Styling** | **Design System PosMarket** | Couleurs `brand` (#059669), fonds `gray-50`, bordures `gray-100` |
| **Icônes** | **`lucide-react-native`** | Même catalogue d'icônes que le web (`lucide-react`) |
| **Data Fetching** | **`@tanstack/react-query`** | Gestion du cache, revalidation et requêtage serveur |
| **Images** | **`expo-image`** | Mise en cache disque, chargement progressif et fluidité 60fps |
| **Stockage sécurisé** | **AsyncStorage** | Stockage du cache acheteur (`buyer_data_cache_v2`) |

---

## 3. Déroulement des Phases

### Phase 1 : Initialisation & Environnement
- [x] 1.1 Créer le projet Expo avec TypeScript et Expo Router.
- [x] 1.2 Configurer le design system avec la palette PosMarket (couleur `brand` #059669, fonds `gray-50`, bordures `gray-100`).
- [x] 1.3 Installer et configurer les dépendances essentielles.

### Phase 2 : Réutilisation du Socle Existant (Types, Utils & API)
- [x] 2.1 Copier les définitions de types depuis `src/types/index.ts` (`Product`, `StoreData`, `CartItem`, etc.).
- [x] 2.2 Copier les fonctions utilitaires depuis `src/utils/` (`formatCurrency`, `formatNumber`, `generateProductSlug`, calculs panier).
- [x] 2.3 Créer le client API (`src/api/client.ts`) pointant vers le serveur PosMarket (`https://posmarket-eight.vercel.app`) et créer les routes REST correspondantes côté Next.js.

### Phase 3 : Transposition du Design System & Composants UI
- [x] 3.1 Créer la version native de **`ProductCard`** (3 états de bouton : + Ajouter, Choisir, Rupture ; retours tactiles).
- [x] 3.2 Transposer le composant **`Loader`** aux couleurs `brand`.
- [x] 3.3 Créer la barre de navigation inférieure native (Tabs avec badges et icônes Lucide).

### Phase 4 : Arborescence des Écrans (Expo Router)
Structure cible du dossier `app/` :
```text
app/
├── (tabs)/
│   ├── index.tsx          # Accueil / Marketplace (grille shopping & food, recherche)
│   ├── categories.tsx     # Exploration des rayons
│   ├── cart.tsx           # Panier & récapitulatif
│   └── account.tsx        # Espace Acheteur ("Mon Compte" : commandes, adresses)
├── product/
│   └── [slug].tsx         # Fiche Produit détaillée (galerie, options, avis, produits liés)
├── store/
│   └── [slug].tsx         # Vitrine de la boutique
├── checkout.tsx           # Validation de commande (adresse, moyen de paiement)
└── _layout.tsx            # Providers globaux (React Query, CartProvider, OfflineBanner)
```
- [x] 4.1 **Écran Accueil (`index.tsx`)** : En-tête avec barre de recherche, filtres catégories, grille 2 colonnes avec `FlatList` optimisée.
- [x] 4.2 **Fiche Produit (`product/[slug].tsx`)** : Galerie d'images, sélecteur d'options/variantes, tarifs de gros, avis clients, sticky bottom bar.
- [x] 4.3 **Espace Acheteur (`account.tsx`)** : Gestion des adresses de livraison (`buyer_addresses`), suivi des commandes, synchronisation et persistance `buyer_data_cache_v2`.
- [x] 4.4 **Vitrine Boutique (`store/[slug].tsx`)** : Profil boutique, filtres de catégories et grille de produits.
- [x] 4.5 **Écran Validation (`checkout.tsx`)** : Formulaire de livraison, modes de paiement, clé d'idempotence et modale de confirmation.

### Phase 5 : Fonctionnalités Spécifiques Android
- [x] 5.1 **Bannière hors-ligne** : Détection du statut réseau via `@react-native-community/netinfo` (`OfflineBanner.tsx`).
- [x] 5.2 **Notifications Push** : Module `notifications.ts` pour alerter l'acheteur lors de la confirmation de commande.
- [x] 5.3 **Assets & Branding** : Définition de l'icône adaptative Android (`android-icon-foreground.png`, `#059669`) dans `app.json`.

### Phase 6 : Génération de l'APK (Build & Test)
- [x] 6.1 Configurer EAS Build (`eas.json`) avec le profil de build APK autonome (`preview` -> buildType `apk`).
- [ ] 6.2 Lancer la compilation de l'APK :
  ```bash
  eas build -p android --profile preview
  ```
- [ ] 6.3 Télécharger et installer l'APK directement sur smartphone Android pour test.
