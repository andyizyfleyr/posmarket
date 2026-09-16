# Guide d'utilisation PosMarket

> Documentation à l'adresse : **https://posmarket-eight.vercel.app/docs/utilisation**

Ce fichier est la source markdown du guide. La version en ligne est une page Next.js avec un design riche.

---

## 1. Marketplace (Acheteur)

### Parcours

**1. Accueil → 2. Recherche → 3. Panier → 4. Paiement**

### Rechercher un produit

1. Cliquez sur la barre de recherche en haut de la page
2. Tapez un mot-clé (ex: "crème visage")
3. Les suggestions s'affichent pendant la frappe
4. Cliquez sur un résultat ou appuyez sur Entrée

> La recherche est en français, sans accents et par similarité d'orthographe. Les résultats sont classés par pertinence et popularité.

### Parcourir par catégorie

13 catégories : Cosmétique & Emballage, Électronique, Mode & Accessoires, Épicerie, Restauration, Mobilier, Beauté / Santé, Auto & Moto, Sport & Loisirs, Bricolage, Livres & Papeterie, Jouets, Divers.

Tous les prix sont en **FCFA (XOF)**.

### Fiche produit

- Photos multiples
- Prix unitaire + remises en gros
- Options / variantes (taille, couleur…)
- Temps de livraison estimé
- Avis clients avec étoiles

### Passer commande (3 étapes)

1. **Panier** — Vérifiez vos articles, appliquez un code promo, cliquez "Commander"
2. **Livraison** — Renseignez nom, téléphone et adresse de livraison
3. **Paiement** — Choisissez Espèces (à la livraison)

> Une boutique peut imposer un minimum de commande. Les commandes multi-boutiques sont groupées.

### Espace Mon Compte (4 onglets)

- **Commandes** — Historique et statut (En attente / Prête / Validée)
- **Adresses** — Adresses de livraison enregistrées
- **Avis** — Avis laissés sur des produits
- **Profil** — Nom, téléphone, déconnexion

---

## 2. Backoffice Vendeur

### Créer son compte et démarrer

1. **Créez votre compte** — Allez sur "Se connecter", onglet "Créer un compte"
2. **Choisissez votre plan** — Choisissez parmi Starter, Pro ou Entreprise (aucun abonnement actif est créé à l'inscription)
3. **Créez votre boutique** — "Nouvelle boutique" dans la barre de navigation
4. **Ajoutez vos produits** — Nom, prix, stock et photo

### Plans d'abonnement

| Plan | Prix/mois | Prix/trimestre | Prix/an | Boutiques | Produits | Boutique en ligne |
|---|---|---|---|---|---|---|
| Starter | 25 000 FCFA | 40 000 FCFA | 70 000 FCFA | 1 | 50 | Non |
| Pro | 40 000 FCFA | 60 000 FCFA | 150 000 FCFA | 3 | 500 | Oui |
| Entreprise | 70 000 FCFA | 95 000 FCFA | 350 000 FCFA | Illimité | Illimité | Oui |

> Seuls Pro et Entreprise ont une boutique visible par les acheteurs.

### Fonctionnalités vendeur

| Page | Description | URL |
|---|---|---|
| Tableau de bord | KPIs : produits, clients, commandes du jour, CA du mois | `/dashboard` |
| Produits | Créer, modifier, supprimer. Prix, stock, variantes, image | `/inventory` |
| Commandes | Statuts En attente → Prête → Validée. Recherche | `/orders` |
| Point de Vente | Caisse en magasin ou Click & Collect, reçu imprimable | `/pos` |
| Clients | Fichier trié par dépense. Créés à chaque commande | `/customers` |
| Factures | Brouillon → payée. Impression PDF ou ticket 80mm | `/invoices` |
| Paramètres | Logo, thème, codes promo, staff, multi-boutiques | `/settings` |
| Rapports | CA et revenus par période (Pro et Entreprise) | `/reports` |
| Abonnement | Changer de plan ou de durée, effet immédiat | `/subscription` |

---

## 3. Astuces et fonctionnalités

- **Comptes séparés** — Acheteur et vendeur sont deux espaces distincts
- **Notifications push** — Vendeurs : commandes, stock bas, avis. Acheteurs : promos
- **Photos de bonne qualité** — Compression automatique (WebP), même sur 3G
- **Application sur téléphone** — Installez PosMarket comme une PWA. Panier conservé hors ligne
- **Paiement protégé** — Espèces à la livraison ou carte bancaire sécurisée
- **Bien vendre = bien décrire** — Produits bien décrits remontent mieux dans la recherche

---

## 4. Problèmes fréquents

| Problème | Solution |
|---|---|
| « Session expirée » | Reconnectez-vous via Mon Compte |
| « Minimum de commande requis » | Ajoutez plus d'articles de cette boutique |
| « Limite de produits atteinte » | Passez à un plan supérieur |
| « Limite de boutiques atteinte » | Passez à un plan supérieur ou supprimez une boutique |
| Paiement carte échoue | Réessayez, ou choisissez espèces à la livraison |
| Photo ne s'affiche pas | Rechargez la page et réessayez |
