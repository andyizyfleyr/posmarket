# Documentation PosMarket — Guide d'utilisation pas à pas

---

## PARTIE 1 — Installation et configuration technique

### Étape 1 : Prérequis

- Node.js 18 ou plus
- npm (ou yarn)
- Un compte Neon (base PostgreSQL) — le projet utilise Neon Serverless
- Un compte Vercel (pour le déploiement)
- Un compte Cloudflare R2 (pour stocker les images des produits)
- Un compte FusionPay (pour les paiements par carte bancaire)
- Une clé Firebase (pour les notifications push)

### Étape 2 : Cloner et installer

```bash
git clone https://github.com/andyizyfleyr/posmarket
cd posmarket
npm install
```

### Étape 3 : Créer le fichier `.env.local`

Copiez `.env.example` en `.env.local` puis remplissez les variables :

| Variable | Description | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URL de connexion Neon PostgreSQL (format `postgresql://...`) | Oui |
| `NEXT_PUBLIC_FUSIONPAY_API_URL` | URL de l'API FusionPay pour les paiements carte | Oui (si carte bancaire) |
| `FIREBASE_SERVICE_ACCOUNT` | Fichier JSON du compte de service Firebase (en entier, pas encodé en base64) | Oui (pour les notifications) |
| `CLOUDFLARE_ACCOUNT_ID` | Identifiant de votre compte Cloudflare | Oui |
| `R2_ACCESS_KEY_ID` | Clé d'accès R2 | Oui |
| `R2_SECRET_ACCESS_KEY` | Clé secrète R2 | Oui |
| `R2_BUCKET` | Nom du bucket R2 | Oui |
| `R2_PUBLIC_URL` | URL publique du bucket R2 (format `https://pub-...r2.dev`) | Oui |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site (ex: `https://votre-domaine.vercel.app`) | Recommandé |

### Étape 4 : Créer la base de données

```bash
npm run db:migrate
```

Ceci applique toutes les migrations SQL et crée les tables dans la base Neon. Les migrations principales sont :

- **0000** — Tables initiales (produits, commandes, boutiques, clients, etc.)
- **0001** — Espace acheteur (profils, adresses de livraison, liens commandes/avis)
- **0002** — Paramètres système (mode maintenance, indexation auto, rapports hebdo)
- **0003** — Comptes administrateur PAM
- **0004** — Images multiples, unités, temps de livraison/préparation
- **0005 et 0006** — Moteur de recherche (text search en français, sans accents)
- **0007** — Types de comptes (buyer / seller / admin)

> Pour appliquer les migrations 0005-0007 (pas encore dans le journal Drizzle), lancez :
>
> ```bash
> node scripts/apply-migration-0005.mjs
> node scripts/apply-migration-0006.mjs
> node scripts/apply-migration-0007.mjs
> ```

### Étape 5 : Créer le premier compte administrateur

```bash
npm run db:seed:admin -- -u admin -p MonMotDePasse123 -e admin@votresite.com
```

Le premier compte créé devient automatiquement le super-administrateur racine.

### Étape 6 : Lancer en développement

```bash
npm run dev
```

Le site est disponible sur `http://localhost:3000`.

### Étape 7 : Déployer sur Vercel

1. Connectez votre dépôt GitHub à Vercel
2. Ajoutez toutes les variables d'environnement dans le dashboard Vercel (Settings > Environment Variables)
3. Le déploiement se fait automatiquement à chaque push sur `main`
4. Un ping automatique (GitHub Actions toutes les 3 minutes) empêche la base Neon de se mettre en veille

---

## PARTIE 2 — Utilisation de la Marketplace (Acheteur)

La marketplace est le site public : tout le monde peut y accéder sans se connecter.

### 2.1 — Accéder au site

Rendez-vous sur l'URL du site. Vous arrivez sur la page d'accueil qui affiche :

- Un carrousel d'images en haut
- La liste des boutiques inscrites
- Les produits populaires par catégorie
- Une barre de recherche

**Catégories disponibles :**

1. Cosmétique & Emballage
2. Électronique & High-Tech
3. Mode & Accessoires
4. Épicerie & Supermarché
5. Restauration & Livraison Rapide
6. Mobilier & Décoration
7. Beauté, Santé & Bien-être
8. Auto & Moto
9. Sport & Loisirs
10. Bricolage & Jardin
11. Livres & Papeterie
12. Jouets & Enfants
13. Divers

Tous les prix sont affichés en **FCFA (XOF)**.

### 2.2 — Rechercher un produit

**Depuis la page d'accueil :**

1. Cliquez sur la barre de recherche en haut de la page
2. Tapez le nom d'un produit (ex: "crème visage")
3. Des suggestions apparaissent automatiquement pendant que vous tapez
4. Cliquez sur un produit dans les suggestions, ou appuyez sur Entrée pour voir tous les résultats

**Les résultats de recherche** classent les produits par pertinence (nom, description) et popularité (ventes, avis).

### 2.3 — Parcourir par catégorie

1. Cliquez sur le nom d'une catégorie (ex: "Mode & Accessoires")
2. La page affiche tous les produits de cette catégorie
3. Vous pouvez ensuite utiliser la barre de recherche pour filtrer plus précisément

### 2.4 — Consulter une boutique

1. Sur l'accueil, cliquez sur le nom d'une boutique
2. Vous voyez :
   - Le nom et le logo de la boutique
   - Les produits de cette boutique
   - Les avis clients sur les produits de cette boutique

### 2.5 — Voir les détails d'un produit

1. Cliquez sur un produit (depuis l'accueil, une catégorie, ou une boutique)
2. Vous voyez :
   - Les photos du produit (plusieurs images possibles)
   - Le prix unitaire
   - Les remises en gros (si le vendeur a configuré des paliers de prix pour quantités importantes)
   - La description
   - Le temps de livraison estimé
   - Les avis clients avec les étoiles
3. Vous pouvez choisir des options si le produit en a (taille, couleur, etc.)

### 2.6 — Ajouter au panier

1. Sur la fiche d'un produit, choisissez la quantité avec les boutons + et -
2. Cliquez sur **"Ajouter au panier"**
3. Le produit s'ajoute au panier. Un badge orange avec le nombre d'articles apparaît en bas à droite

> Si un produit a des options (taille, couleur...), vous devez d'abord les sélectionner avant de pouvoir l'ajouter au panier.

### 2.7 — Gérer son panier

1. Cliquez sur l'icône du panier (en bas de l'écran sur mobile, ou en haut à droite sur ordinateur)
2. Vous voyez la liste de vos articles groupés par boutique
3. Pour chaque article, vous pouvez :
   - Modifier la quantité (+ et -)
   - Supprimer l'article (bouton X)
4. En bas, vous voyez le sous-total par boutique et le total général

> **Minimum de commande :** Si une boutique a un minimum de commande, un message vous avertit si votre panier est insuffisant. Vous devez ajouter plus d'articles de cette boutique avant de passer commande.

### 2.8 — Appliquer un code promo

1. Dans le panier, cliquez sur **"Ajouter un code promo"**
2. Tapez votre code
3. La remise s'applique automatiquement sur les articles concernés
4. Le nouveau total s'affiche

### 2.9 — Passer commande (étape par étape)

Le passage de commande se fait en 3 étapes : **Panier → Livraison → Paiement**

#### Étape 1 — Panier

- Vérifiez vos articles
- Appliquez un code promo si vous en avez
- Cliquez sur **"Commander"**

#### Étape 2 — Livraison

1. Renseignez vos informations :
   - Nom complet
   - Numéro de téléphone
2. Si vous avez une adresse enregistrée, elle est pré-remplie
3. Vous pouvez en ajouter une nouvelle adresse de livraison
4. Cliquez sur **"Passer au paiement"**

#### Étape 3 — Paiement

1. Choisissez votre méthode de paiement :
   - **Espèces (à la livraison)** — Vous payez en cash à la réception
   - **Carte bancaire** — Paiement en ligne sécurisé via FusionPay
2. Si vous choisissez la carte, vous êtes redirigé vers la page de paiement FusionPay
3. Après le paiement, vous revenez sur le site et la commande est confirmée

**Après la commande :**

- Un message de confirmation s'affiche avec le récapitulatif
- Les détails de la commande apparaissent dans votre espace "Mes commandes"
- Si vous avez choisi la carte et que le paiement échoue, la commande n'est pas créée

### 2.10 — Créer un compte acheteur

Un compte acheteur est créé automatiquement lors de votre première connexion. Pour vous connecter :

1. Cliquez sur **"Mon compte"** (en bas de l'écran sur mobile)
2. Un formulaire de connexion apparaît
3. Entrez votre adresse e-mail et votre mot de passe
4. Si vous n'avez pas encore de compte, passez à l'onglet **"Créer un compte"** :
   - Nom complet
   - Adresse e-mail
   - Mot de passe
5. Cliquez sur **"S'inscrire"**
6. Votre compte est créé et vous êtes automatiquement connecté

> **Important :** Les comptes vendeurs (boutiquiers) et les comptes acheteurs sont séparés. Un compte acheteur ne peut pas accéder au backoffice vendeur, et vice-versa.

### 2.11 — Espace "Mon Compte" (onglets)

Cliquez sur **"Mon compte"** dans la barre de navigation en bas. Vous avez 4 onglets :

#### Onglet 1 — Commandes

- Liste de toutes vos commandes passées
- Chaque commande montre : date, articles, statut (En attente, Prête, Validée), montant total
- Statuts possibles :
  - **En attente** — Le vendeur n'a pas encore traité votre commande
  - **Prête** — La commande est prête pour retrait ou livraison
  - **Validée** — La commande est terminée

#### Onglet 2 — Adresses

- Liste de vos adresses de livraison enregistrées
- Pour ajouter une adresse : cliquez **"Ajouter une adresse"**
  - Nom du destinataire
  - Téléphone
  - Adresse complète
  - Ville
  - Pays
- Pour supprimer une adresse : cliquez sur l'icône poubelle

#### Onglet 3 — Avis

- Liste des avis que vous avez laissés sur des produits
- Pour laisser un avis : allez sur la fiche d'un produit, cliquez **"Laisser un avis"**
  - Note de 1 à 5 étoiles
  - Commentaire (optionnel)
  - Le nom du magasin s'affiche automatiquement

#### Onglet 4 — Profil

- Votre nom d'affichage (modifiable)
- Votre adresse e-mail (non modifiable)
- Votre numéro de téléphone (modifiable)

### 2.12 — Se déconnecter

Dans l'onglet **Profil** de Mon Compte, cliquez sur **"Me déconnecter"**.

### 2.13 — Pages légales

- `/cgv` — Conditions Générales de Vente
- `/confidentialite` — Politique de confidentialité

Ces pages sont accessibles depuis le pied de page du site.

### 2.14 — Mode hors ligne (PWA)

Si vous perdez votre connexion internet, une page s'affiche automatiquement avec le message "Vous êtes hors ligne". Votre panier est conservé. Dès que la connexion revient, le site se recharge.

---

## PARTIE 3 — Backoffice Vendeur (Portail commerçant)

Le backoffice vendeur est l'interface pour gérer sa boutique, ses produits, ses commandes et ses clients.

### 3.1 — Créer un compte vendeur

1. Allez sur `/login`
2. Cliquez sur l'onglet **"Créer un compte"**
3. Remplissez :
   - Nom complet
   - Adresse e-mail
   - Mot de passe
4. Cliquez sur **"S'inscrire"**
5. Vous êtes redirigé vers la page d'**abonnement** pour choisir votre plan

> À l'inscription, un abonnement **Pro mensuel** est créé automatiquement (payant, avec date de fin configurable).

### 3.2 — Se connecter

1. Allez sur `/login`
2. Entrez votre e-mail et mot de passe
3. Cliquez sur **"Se connecter"**
4. Vous accédez au tableau de bord

### 3.3 — Choisir un plan d'abonnement

Après l'inscription, vous êtes sur la page d'abonnement. 3 plans sont disponibles :

| Plan | Prix/mois | Prix/trimestre | Prix/an | Boutiques max | Produits max | Boutique en ligne | Rapports avancés | Reçus custom |
|---|---|---|---|---|---|---|---|---|
| **Starter** | 25 000 FCFA | 40 000 FCFA | 70 000 FCFA | 1 | 50 | Non | Non | Non |
| **Pro** | 40 000 FCFA | 60 000 FCFA | 150 000 FCFA | 3 | 500 | Oui | Oui | Non |
| **Entreprise** | 70 000 FCFA | 95 000 FCFA | 350 000 FCFA | Illimité | Illimité | Oui | Oui | Oui |

1. Choisissez la durée (mensuel, trimestriel ou annuel)
2. Cliquez sur **"Souscrire"**
3. Votre plan est activé

> Seuls les plans Pro et Entreprise donnent accès à la boutique en ligne visible par les acheteurs sur la marketplace. Le plan Starter ne fonctionne qu'en Point de Vente (POS).

### 3.4 — Tableau de bord (`/dashboard`)

C'est la page d'accueil du backoffice. Elle affiche :

- Le nombre total de produits
- Le nombre total de clients
- Les commandes du jour
- Le chiffre d'affaires du mois
- Les dernières commandes reçues

Si vous n'avez aucune boutique, un bouton vous propose d'en créer une.

### 3.5 — Créer sa première boutique

1. Dans la barre de navigation, cliquez sur **"Nouvelle boutique"**
2. Étape 1 : Entrez le **nom de la boutique**
3. Étape 2 : Choisissez le type :
   - **Boutique** (shopping) — Produits physiques
   - **Restaurant** (food) — Restauration / livraison
4. La boutique est créée automatiquement avec un lien (slug) généré à partir du nom
5. Un cookie est défini sur votre navigateur pour indiquer la boutique active

> Vous pouvez avoir plusieurs boutiques selon votre plan (1 avec Starter, 3 avec Pro, illimité avec Entreprise).

### 3.6 — Gérer les produits (`/inventory`)

#### Ajouter un produit

1. Cliquez sur **"Ajouter un produit"**
2. Remplissez les informations :
   - **Nom** du produit
   - **Description** (optionnelle)
   - **Prix** de vente (en FCFA)
   - **Stock** disponible (quantité en stock)
   - **Unité** (optionnel : kg, litre, pièce, etc.)
   - **Catégorie** — Choisissez parmi les catégories du vendeur (qui sont mappées aux catégories marketplace)
   - **Image** — Téléchargez une photo (compressée automatiquement en WebP)
   - **Options / Variantes** — Si le produit existe en plusieurs versions (taille, couleur), ajoutez des options avec un prix et un stock par variante
   - **Prix de gros** — Si vous vendez en gros, ajoutez des paliers de remise par quantité
   - **Livraison** — Temps de livraison estimé (ex: "2-3 jours")
   - **Préparation** — Temps de préparation (ex: "24h")
   - **En ligne** — Active/désactive la visibilité du produit sur la marketplace
3. Cliquez sur **"Enregistrer"**

> **Limite de produits :** Selon votre plan, vous ne pouvez pas dépasser le nombre maximum (50 pour Starter, 500 pour Pro, illimité pour Entreprise). Si vous essayez d'ajouter un produit au-delà de la limite, un message d'erreur s'affiche.

#### Modifier un produit

1. Dans la liste des produits, cliquez sur un produit
2. Modifiez les champs souhaités
3. Cliquez sur **"Enregistrer"**

#### Supprimer un produit

- **Un seul :** Cliquez sur l'icône poubelle à côté du produit, puis confirmez
- **Plusieurs :** Cochez les produits souhaités, puis cliquez sur **"Supprimer la sélection"**

#### Filtrer les produits

- Par type : tous, en ligne uniquement, ou hors ligne uniquement
- Par catégorie
- Par recherche (nom du produit)

### 3.7 — Gérer les commandes (`/orders`)

La page des commandes affiche toutes les commandes reçues.

#### Statuts des commandes

- **En attente (PENDING)** — Nouvelle commande, pas encore traitée
- **Prête (READY)** — Commande préparée, prête pour retrait ou livraison
- **Validée (COMPLETED)** — Commande terminée

#### Actions possibles

1. **Changer le statut :** Sélectionnez une commande, puis cliquez sur le nouveau statut souhaité
2. **Supprimer :** Cliquez sur l'icône poubelle (ou sélectionnez plusieurs commandes et supprimez-les en bloc)
3. **Voir les détails :** Cliquez sur une commande pour voir :
   - La liste des articles commandés
   - Le montant total
   - Le nom du client (si fourni)
   - Le mode de paiement (Espèces ou Carte)

#### Filtrer les commandes

- Par statut (En attente / Prête / Validée / Toutes)
- Par recherche (ID de commande, nom du client, email)

**Pagination :** Si vous avez beaucoup de commandes, utilisez les boutons de navigation en bas de la liste.

### 3.8 — Point de Vente (POS) (`/pos`)

Le POS est une caisse enregistreuse numérique pour vendre en magasin.

#### Utilisation

1. Allez sur `/pos`
2. **Recherchez un produit** dans la barre de recherche, ou parcourez les catégories
3. **Ajoutez au panier** en cliquant sur un produit
4. **Ajustez la quantité** avec + et -
5. (Optionnel) **Ajoutez un code promo**
6. (Optionnel) **Sélectionnez un client** existant ou créez-en un nouveau
7. **Choisissez le type de commande :**
   - **En magasin (IN_STORE)** — Le client repart avec ses produits
   - **Click & Collect (PICKUP)** — Le client vient récupérer sa commande plus tard
8. Cliquez sur **"Payer"** — Le paiement est enregistré comme **Espèces** par défaut
9. Un **reçu** s'affiche que vous pouvez imprimer (format ticket 80mm ou PDF)
10. La commande est enregistrée dans `/orders` avec le statut **Validée** et le type correspondant

### 3.9 — Gérer les clients (`/customers`)

La page clients liste tous les clients de votre boutique.

#### Ajouter un client

1. Cliquez sur **"Ajouter un client"**
2. Remplissez :
   - Nom
   - Téléphone
   - E-mail (optionnel)
3. Cliquez sur **"Enregistrer"**

#### Modifier un client

- Cliquez sur un client dans la liste, modifiez les champs, enregistrez

#### Supprimer

- Un seul : icône poubelle
- Plusieurs : sélectionnez et supprimez en bloc

**Tri :** Les clients sont classés par montant total dépensé (les plus gros clients en premier).

> Les clients sont aussi créés automatiquement lors d'une commande en ligne (marketplace) ou en magasin (POS).

### 3.10 — Gérer les factures (`/invoices`)

Les factures permettent de créer des factures formelles pour vos clients.

#### Créer une facture

1. Cliquez sur **"Nouvelle facture"**
2. Sélectionnez le client (ou créez-en un)
3. Ajoutez les articles :
   - Nom de l'article
   - Quantité
   - Prix unitaire
4. Le total se calcule automatiquement
5. Enregistrez la facture

#### Statuts d'une facture

- **Brouillon (DRAFT)** — Facture en cours de rédaction
- **Envoyée (SENT)** — Facture envoyée au client
- **Payée (PAID)** — Facture payée
- **En retard (OVERDUE)** — Facture dont le délai de paiement est dépassé

#### Imprimer une facture

- Cliquez sur une facture puis sur **"Imprimer"** pour générer une version imprimable (PDF ou reçu 80mm)

> Les factures Pro sont disponibles uniquement aux plans Pro et Entreprise.

### 3.11 — Gérer les paramètres (`/settings`)

#### Paramètres de la boutique

- **Nom de la boutique** — Modifiable (le lien /slug est mis à jour automatiquement)
- **Logo** — Téléchargez un logo (stocké sur Cloudflare R2)
- **Thème / disposition** — Apparence de votre boutique en ligne
- **Devise** — FCFA (par défaut)
- **Contact** — Informations de contact

#### Gestion des codes promo

1. Dans l'onglet "Promotions", cliquez **"Ajouter un code promo"**
2. Remplissez :
   - Le code (ex: SOLDES2026)
   - Le pourcentage de remise
   - La date d'expiration
3. Activez ou désactivez le code avec le bouton à bascule

#### Gestion du personnel (staff)

1. Cliquez **"Ajouter un membre"**
2. Entrez l'adresse e-mail d'un autre vendeur
3. Choisissez son rôle :
   - **Propriétaire** — Accès complet
   - **Staff** — Accès limité (selon les permissions définies)
4. La personne reçoit un accès à votre boutique

> Si la personne n'a pas encore de compte, un compte lui est créé automatiquement.

#### Gestion des boutiques

- Depuis les paramètres, vous pouvez aussi créer de nouvelles boutiques ou supprimer des boutiques existantes
- Vous ne pouvez jamais supprimer toutes vos boutiques (minimum 1)

### 3.12 — Rapports et statistiques (`/reports`)

Cette page affiche :

- Le chiffre d'affaires total
- Le nombre de commandes
- Les revenus par période
- Un aperçu du reçu par commande

> Cette page est disponible uniquement pour les plans Pro et Entreprise.

### 3.13 — Changer d'abonnement (`/subscription`)

1. Allez sur `/subscription`
2. Voir votre plan actuel et sa date d'expiration
3. Choisissez un nouveau plan (Starter / Pro / Entreprise)
4. Choisissez la durée
5. La nouvelle souscription prend effet immédiatement

### 3.14 — Changer de boutique active

Si vous avez plusieurs boutiques :

1. Dans la barre de navigation en haut, cliquez sur le nom de la boutique active
2. Sélectionnez une autre boutique dans la liste
3. Toutes les données (produits, commandes, clients, etc.) changent pour refléter la boutique sélectionnée

---

## PARTIE 4 — Portail Administrateur (PAM)

Le portail administrateur (`/pam`) permet de gérer l'ensemble de la plateforme.

### 4.1 — Se connecter en admin

1. Allez sur `/pam/login`
2. Entrez votre nom d'utilisateur et mot de passe
3. Cliquez sur **"Se connecter"**

> Seuls les comptes admin créés avec `npm run db:seed:admin` peuvent se connecter. La session dure 8 heures.

### 4.2 — Tableau de bord global (`/pam`)

La page d'accueil affiche :

- Le nombre total de boutiques
- Le nombre total d'utilisateurs
- Le volume de ventes total
- Le nombre total de produits
- Les boutiques en attente d'approbation
- Les dernières boutiques inscrites
- L'état de l'infrastructure

### 4.3 — Gérer les boutiques (`/pam/stores`)

- Liste de toutes les boutiques regroupées par propriétaire
- Recherche par nom de boutique
- Filtre par statut : toutes, en attente, approuvées, désactivées

#### Actions possibles

- **Approuver / Rejeter / Désactiver** une boutique (bouton par boutique)
- **Supprimer** une boutique (avec confirmation)
- **Supprimer en bloc** plusieurs boutiques
- Voir le détail d'une boutique (`/pam/stores/[id]`) : contact, statistiques, propriétaire

### 4.4 — Gérer les utilisateurs (`/pam/users`)

- Liste de tous les comptes (acheteurs, vendeurs, admins)
- Recherche par nom ou e-mail
- Pagination

#### Actions possibles

- **Promouvoir / Révoquer** super-administrateur
- **Changer le plan d'abonnement** d'un vendeur (Starter / Pro / Entreprise)
- **Supprimer** un compte (avec confirmation)
- **Supprimer en bloc** plusieurs comptes
- Voir le détail d'un utilisateur (`/pam/users/[id]`) : identité, plan, liste de ses boutiques

### 4.5 — Gérer les commandes globales (`/pam/orders`)

- Liste de toutes les commandes de toutes les boutiques
- Recherche par ID, boutique, ou email du client
- Filtre par statut
- Détail d'une commande : totaux, mode de paiement, articles

### 4.6 — Gérer les produits globaux (`/pam/inventory`)

- Recherche de produits dans toutes les boutiques
- Badge de stock bas (produits en rupture ou en stock faible)
- Possibilité de supprimer des produits problématiques

### 4.7 — Modérer les avis (`/pam/reviews`)

- Recherche d'avis par auteur, commentaire, boutique, ou produit
- Affichage de la note (étoiles)
- Possibilité de supprimer des avis inappropriés

### 4.8 — Paramètres système (`/pam/settings`)

3 interrupteurs :

- **Mode maintenance** — Désactive l'accès public au site
- **Indexation automatique** — Active/désactive l'indexation SEO automatique
- **Rapports hebdomadaires** — Active/désactive l'envoi de rapports par e-mail

### 4.9 — Gérer les factures globales (`/pam/invoices`)

- Liste de toutes les factures de toutes les boutiques
- Recherche par numéro, client, ou boutique
- Filtre par statut

### 4.10 — Se déconnecter

Dans la barre latérale, cliquez sur **"Déconnexion"**.

---

## PARTIE 5 — Fonctionnalités transverses

### 5.1 — Séparation des comptes

Il existe 3 types de comptes :

- **Acheteur (buyer)** — Accède à la marketplace et à `/mon-compte`
- **Vendeur (seller)** — Accède à `/login` et au backoffice (`/dashboard`, `/pos`, `/orders`, etc.)
- **Admin (PAM)** — Accède à `/pam` et au portail administrateur

Un acheteur ne peut **jamais** accéder au backoffice vendeur, et inversement. Si un vendeur tente de se connecter en tant qu'acheteur, un message d'erreur s'affiche.

### 5.2 — Moteur de recherche

Le moteur de recherche de la marketplace est en français, avec :

- Recherche par mots-clés (nom et description des produits)
- Recherche par similarité (orthographe proche)
- Recherche sans accents (accent-insensible)
- Suggestions automatiques pendant la frappe
- Classement par pertinence et popularité

### 5.3 — Notifications push

Les vendeurs reçoivent des notifications push (via Firebase Cloud Messaging) pour :

- Nouvelles commandes
- Stock bas
- Nouveaux avis
- Abonnement bientôt expiré

Les acheteurs peuvent aussi recevoir des notifications web push pour les promotions.

### 5.4 — Images des produits

- Les images sont compressées automatiquement au format WebP (max 800 Ko, max 1200px de largeur)
- Les images sont stockées sur Cloudflare R2 (CDN rapide)
- Les anciens produits avec des images en base64 sont migrés automatiquement via le script `migrate-images-r2.mts`

### 5.5 — PWA (Application Web Progressive)

Le site est installable sur un téléphone comme une application :

1. Sur votre téléphone, ouvrez le site
2. Un bandeau "Ajouter à l'écran d'accueil" s'affiche
3. Suivez les instructions pour installer l'application
4. Vous pouvez ensuite accéder au site depuis votre écran d'accueil, comme une application native
5. En mode hors ligne, une page spéciale s'affiche et votre panier est conservé

### 5.6 — Bot blocking

Le serveur bloque automatiquement les bots agressifs (scrapeurs SEO comme Semrush, Ahrefs, etc.) avec un code 403. Les robots d'indexation légitimes (Google, Bing) ne sont pas bloqués.

### 5.7 — API santé (`/api/ping`)

Un endpoint de vérification de santé est disponible à `/api/ping`. Il vérifie que la base de données est accessible. Utilisé par le GitHub Actions pour garder la base Neon éveillée (ping toutes les 3 minutes).

### 5.8 — Gestion du cache

- Les pages de la marketplace se revalident toutes les 60 secondes (ISR)
- Les données des commandes vendeur sont mises en cache 20 secondes
- Le cache de l'acheteur (commandes, adresses, avis) est stocké côté client avec la clé `buyer_data_cache_v2`
- Les actions serveur invalident automatiquement les caches pertinents lors de modifications

---

## PARTIE 6 — Problèmes fréquents

| Problème | Solution |
|---|---|
| **"Session expirée"** | Votre session a expiré. Reconnectez-vous via l'onglet "Mon compte". |
| **"Minimum de commande requis"** | Le montant de votre panier pour une boutique est insuffisant. Ajoutez plus de produits de cette boutique. |
| **"Limite de produits atteinte"** | Vous avez atteint le nombre maximum de produits de votre plan. Passez à un plan supérieur. |
| **"Limite de boutiques atteinte"** | Vous avez atteint le nombre maximum de boutiques de votre plan. Passez à un plan supérieur. |
| **Le paiement par carte ne fonctionne pas** | Vérifiez que la variable `NEXT_PUBLIC_FUSIONPAY_API_URL` est correctement configurée. Si elle est absente, seuls les paiements en espèces fonctionnent. |
| **Les images ne s'affichent pas** | Vérifiez que les variables `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` et `R2_PUBLIC_URL` sont correctes. |
