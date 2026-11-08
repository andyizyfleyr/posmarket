# Migration de base Neon (changement de quota)

Objectif : transférer la base de production vers un **nouveau projet Neon**
(un « branch » du même projet garderait les mêmes quotas et ne réglerait
donc pas le problème), avec une copie complète et vérifiée des données.

> Rien n'est détruit ni supprimé côté ancienne base : elle devient simplement
> inutilisée (et Neon l'éteindra seule). R2 (images) et le code ne bougent pas.

## Étape 0 — Sauvegarder
Dans la console Neon (neon.tech) : ouvre l'ancien projet → **New branch** à
partir de `main`. Ce branch sert de **point de restauration** (gratuit).

## Étape 1 — Créer la nouvelle base
Dans la console Neon : **New Project** → choisis la région (ex. où les
utilisateurs se trouvent, ex. `aws-us-east-2`) → crée.
Copie la **connection string** complète
(`postgresql://neondb_owner:...@ep-XXX.neon.tech/neondb?sslmode=require`).

## Étape 2 — Appliquer le schéma sur la nouvelle base
Dans **.env.local** de ce repo (fichier non versionné) :
```
DATABASE_URL=postgresql://neondb_owner:MOT_DE_PASSE@ep-XXX-.neon.tech/neondb?sslmode=require
OLD_DATABASE_URL=postgresql://neondb_owner:ANCIEN_MDP@ep-YYY-.neon.tech/neondb?sslmode=require
```
Puis :
```bash
npm run db:migrate
```
(les 38 migrations créent toutes les tables sur la nouvelle base)

## Étape 3 — Copier les données
À faire **caisse fermée** (2-5 min, hors heures de vente), pour éviter toute
vente coincée entre l'ancienne et la nouvelle base.
```bash
node --env-file=.env.local --import tsx scripts/migrate-neon.mts
```
Le script affiche un résumé par table et un total. Idempotent : rejouable.

## Étape 4 — Vérifier
```bash
node --env-file=.env.local --import tsx scripts/migrate-neon.mts --verify-only
```
Chaque table doit afficher `✓ old → old`. Sinon : ne bascule pas.

## Étape 5 — Basculer l'application
Sur Vercel → projet → **Settings → Environment Variables** → `DATABASE_URL`
= la NOUVELLE connection string → **Save** → onglet **Deployments** →
**Redeploy** (obligatoire pour charger la nouvelle variable).
En local : la même valeur dans `.env.local`.

## Étape 6 — Vérifier en prod
- `/pos` charge le catalogue, une vente test passe et réapparaît dans
  `/orders` et `/dashboard`
- photos des produits OK (R2 inchangé — normal)
- notifications e-mail OK

## Notes
- Le keep-warm `.github/workflows/keep-warm.yml` pingue `posmarket-topaz.vercel.app` :
  il chauffe l'ANCIENNE base. Après la bascule, il ne sert plus. À basculer sur
  `https://posmarket-eight.vercel.app/api/ping` **uniquement si cette URL est
  publique (sans SSO Vercel)**, sinon on le laisse tel quel (sans risque).
- Les migrations futures (`npm run db:migrate`) lues par drizzle s'appliquent
  automatiquement sur la nouvelle base (journal inclus).
- `pg_dump`/`pg_restore` restent l'alternative si le script échoue :
  `pg_dump --no-owner --no-privileges -Fc "<OLD>" > posmarket.dump` puis
  `pg_restore --clean --if-exists --no-owner -d "<NEW>" posmarket.dump`.
