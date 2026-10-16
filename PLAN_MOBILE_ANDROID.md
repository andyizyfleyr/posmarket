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
| **Styling** | **NativeWind v4** | Utilisation des classes Tailwind CSS identiques à PosMarket |
| **Icônes** | **`lucide-react-native`** | Même catalogue d'icônes que le web (`lucide-react`) |
| **Data Fetching** | **`@tanstack/react-query`** | Gestion du cache, revalidation et requêtage serveur |
| **Images** | **`expo-image`** | Mise en cache disque, chargement progressif et fluidité 60fps |
| **Stockage sécurisé** | **`expo-secure-store`** / **AsyncStorage** | Stockage du token de session et du cache acheteur |

---

## 3. Déroulement des Phases

### Phase 1 : Initialisation & Environnement
- [ ] 1.1 Créer le projet Expo avec TypeScript et Expo Router :
  ```bash
  npx create-expo-app@latest posmarket-mobile -t tabs
  cd posmarket-mobile
  ```
- [ ] 1.2 Configurer **NativeWind v4** (Tailwind CSS) avec la palette de couleurs de PosMarket (notamment la couleur `brand`, les fonds `gray-50`, les bordures `gray-100`).
- [ ] 1.3 Installer les dépendances essentielles :
  ```bash
  npx expo install expo-image expo-secure-store lucide-react-native @tanstack/react-query @react-native-community/netinfo
  ```

### Phase 2 : Réutilisation du Socle Existant (Types, Utils & API)
- [ ] 2.1 Copier les définitions de types depuis `src/types/index.ts` (modèles `Product`, `StoreData`, `CartItem`, `Order`, etc.).
- [ ] 2.2 Copier les fonctions utilitaires depuis `src/utils/` :
  - `formatCurrency`, `formatNumber`
  - `generateProductSlug` (`src/utils/slug.ts`)
  - Logique de calcul du panier et remises
- [ ] 2.3 Créer le client API (`src/api/client.ts`) pointant vers le serveur PosMarket (`NEXT_PUBLIC_API_URL` ou URL de production).

### Phase 3 : Transposition du Design System & Composants UI
- [ ] 3.1 Créer la version native de **`ProductCard`** :
  - Transposition `div` $\rightarrow$ `View`, `span`/`p` $\rightarrow$ `Text`.
  - Intégration de `expo-image` pour les visuels.
  - Gestion des 3 états du bouton : **`+ Ajouter`**, **`Choisir`** (options obligatoires) et **`Rupture`** (stock à 0).
  - Feedback tactile avec effet d'échelle `active:scale-95` et état `adding` avec loader.
- [ ] 3.2 Transposer le composant **`Loader`** :
  - Spinner animé aux couleurs `brand`.
- [ ] 3.3 Créer la barre de navigation inférieure native (Tabs).

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
└── _layout.tsx            # Providers globaux (React Query, CartProvider, AuthProvider)
```
- [ ] 4.1 **Écran Accueil (`index.tsx`)** :
  - En-tête avec barre de recherche et filtres de catégories (`shopping` & `food`).
  - Grille 2 colonnes avec `FlatList` optimisée.
- [ ] 4.2 **Fiche Produit (`product/[slug].tsx`)** :
  - Galerie d'images avec zoom.
  - Sélecteur d'options / variantes.
  - Barre d'action fixe en bas d'écran (*Sticky Bottom Bar*) : "Ajouter au panier" et "Acheter maintenant".
  - Section "Dans la même boutique" affichant les `ProductCard` associées.
- [ ] 4.3 **Espace Acheteur (`account.tsx`)** :
  - Gestion des adresses de livraison (`buyer_addresses`).
  - Suivi des commandes en cours et historique.

### Phase 5 : Fonctionnalités Spécifiques Android
- [ ] 5.1 **Bannière hors-ligne** : Détection du statut réseau via `@react-native-community/netinfo` identique au web.
- [ ] 5.2 **Notifications Push** : Intégration d'Expo Notifications pour alerter l'acheteur du suivi de commande.
- [ ] 5.3 **Assets & Branding** : Définition de l'icône adaptative Android (`adaptive-icon.png`) et du Splash screen dans `app.json`.

### Phase 6 : Génération de l'APK (Build & Test)
- [ ] 6.1 Configurer EAS Build (`eas.json`) avec le profil de build APK autonome :
  ```json
  {
    "build": {
      "preview": {
        "android": {
          "buildType": "apk"
        }
      }
    }
  }
  ```
- [ ] 6.2 Lancer la compilation de l'APK :
  ```bash
  eas build -p android --profile preview
  ```
- [ ] 6.3 Télécharger et installer l'APK directement sur smartphone Android pour test.
