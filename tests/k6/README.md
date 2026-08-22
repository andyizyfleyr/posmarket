# Tests de charge k6 — PosMarket

## Installation de k6

Le binaire Windows est déjà présent localement (non versionné) :

```bash
npm run test:k6:smoke
# ou directement
.tools\k6\k6-v2.2.0-windows-amd64\k6.exe run tests/k6/browse.js
```

Pour l'installer dans le PATH (`winget`, `choco` ou `brew`) : voir https://grafana.com/docs/k6/latest/set-up/install-k6/

## Scripts

| Script | Rôle |
|---|---|
| `smoke.js` | Sanity check : 1 itération sur les routes clés (accueil, cart, login, CGV…) |
| `browse.js` | Test de charge principal : parcours accueil → produit → boutique, montée en charge progressive |
| `writes.js` | Flux d'écriture : POST `/api/set-store` + action serveur checkout (opt-in) |

## Utilisation

```bash
# Smoke test
k6 run tests/k6/smoke.js

# Navigation (20 VUs par défaut, ~4min30)
k6 run tests/k6/browse.js

# Personnaliser la charge
k6 run -e VUS=50 -e PLATEAU=5m tests/k6/browse.js

# Cibler un autre environnement
k6 run -e BASE_URL=http://localhost:3000 tests/k6/browse.js

# Flux d'écriture
k6 run tests/k6/writes.js
```

## Test du checkout (écriture)

Le panier étant stocké en `localStorage` côté client, l'ajout au panier ne génère
aucun appel serveur. Le seul point de contact serveur du tunnel d'achat est
l'action `submitCheckoutAction`, invoquée via un header `Next-Action` dont l'ID
est propre à chaque build.

Pour récupérer cet ID :
1. Ouvre le site dans le navigateur, onglet **DevTools → Network**
2. Ajoute un produit au panier et soumets une commande
3. Repère la requête **POST** émise vers `/cart` avec le header **`Next-Action`**
4. Copie cette valeur puis lance :

```bash
k6 run -e CHECKOUT_ACTION_ID=<valeur> tests/k6/writes.js
```

⚠️ L'ID change à chaque déploiement (nouveau build = nouveaux IDs).

## ⚠️ Avertissements

- Les tests ciblent **la production** : chaque requête consomme des invocations
  Vercel et de la bande passante. Commence bas (`-e VUS=5`) et augmente progressivement.
- `submitCheckoutAction` est actuellement un **stub** : il renvoie un succès fictif
  sans écrire en base. Le test mesure donc la mécanique server actions, pas une vraie commande.
- Ne jamais pointer les tests vers la création de commandes réelles
  (`createOrderAction`, protégée par auth) : cela polluerait les données des boutiques.

## 📊 Premier constat (run du 22/08/2026)

À seulement **2 VUs**, chaque page met **3 à 4,5 s** (p95) à répondre et pèse
**~3,5 Mo de HTML** : la home sérialise tout le marketplace (toutes les boutiques
+ produits) dans le payload RSC. `fetchMarketplaceData` est rappelé sans cache
sur chaque page. Pistes : pagination, cache (`unstable_cache`/ISR), payload allégé.
Les seuils des scripts (p95 < 800 ms) sont des cibles — ils échouent volontairement
tant que ce n'est pas atteint.
