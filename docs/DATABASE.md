# Base de données — état, migrations et vérification

## Ce qui a changé (contexte)

Le projet a vécu sur **deux comptes Vercel** alimentés par le même dépôt GitHub,
chacun déclenchant son propre build à chaque `push`. Un seul projet est désormais
actif ; l'autre est en pause. Conséquence pratique : **une seule base Neon**
(PostgreSQL managé) est visée par la production, mais rien, jusqu'ici, ne
vérifiait que son schéma correspondait au code déployé.

Les migrations de ce dépôt ont longtemps été appliquées à la main
(`node scripts/apply-migration-*.mjs`), sans journal. Deux dérives en résultent :

1. des migrations présentes dans `drizzle/` mais jamais jouées en production ;
2. un journal Drizzle (`drizzle/meta/_journal.json`) incomplet, donc
   `npm run db:migrate` inutilisable sur une base neuve.

## Vérifier l'état réel de la base

### Option A — depuis n'importe quelle machine ayant `psql`

```bash
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "\d orders" | grep -E 'buyer_phone|boosted'
```

### Option B — sans client PostgreSQL

Le dépôt fournit un script qui sonde `information_schema` et n'applique rien :

```bash
DATABASE_URL="postgresql://…" node scripts/apply-pending-migrations.mjs --dry-run
```

Il choisit automatiquement son transport :

| Environnement | Transport | Remarque |
|---|---|---|
| Vercel / Node avec endpoint HTTP Neon | `@neondatabase/serverless` (HTTPS) | une requête HTTP par instruction |
| Local, GitHub Actions, base `*.tech` | `pg` (TCP + TLS) | indispensable : les bases `.tech` n'exposent pas l'endpoint HTTP |

### Option C — depuis l'application elle-même

`GET /api/cron/schema-check` interroge la base avec les droits de production et
renvoie `503` + la liste des objets manquants (aucune donnée, seulement des noms).

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/schema-check
```

Le cron Vercel l'appelle une fois par jour ; un schéma incomplet apparaît donc
dans les journaux sans intervention.

## Appliquer les migrations manquantes

```bash
# 1. Voir ce qui manque
DATABASE_URL="postgresql://…" node scripts/apply-pending-migrations.mjs --dry-run

# 2. Appliquer
DATABASE_URL="postgresql://…" node scripts/apply-pending-migrations.mjs
```

Le script ne joue **que** les fichiers absents (sonde par objet témoin) et il est
idempotent : relancé, il affiche `✓ Base à jour`.

### Depuis GitHub Actions (quand le réseau local bloque PostgreSQL)

Le workflow `.github/workflows/migrate.yml` fait la même chose sur un runner :

```bash
gh secret set DATABASE_URL --repo <owner>/<repo>       # une seule fois
gh variable set ENABLE_MIGRATIONS --body "true" --repo <owner>/<repo>

gh workflow run migrate.yml -f dry_run=true            # inspection
gh workflow run migrate.yml -f dry_run=false           # application
```

`ENABLE_MIGRATIONS` est un verrou volontaire : sans lui, le workflow refuse de
démarrer même si le secret existe.

## Contrôle hors ligne (sans base, sans réseau)

```bash
npm run db:check        # cohérence fichiers SQL ↔ journal Drizzle
npm run db:check:sql    # rejeu des 30 migrations sur PGlite (PostgreSQL WASM)
```

`db:check:sql` a révélé deux migrations qui échouaient sur toute base neuve :

| Fichier | Problème | Effet |
|---|---|---|
| `0014_fix_missing_columns.sql` | `DO  BEGIN` / `END ;` sans `$$` | PostgreSQL rejette **tout le fichier** : les 22 colonnes conditionnelles (`profiles.phone`, `products.search_vector`, `orders.buyer_user_id`…) n'étaient jamais ajoutées |
| `0009_email_notifications.sql` | modifiait `notification_outbox`, créée plus tard par `0015` | « relation does not exist » → canal e-mail sans `recipient_email` |

Les deux sont corrigés ; le contrôle compare en plus les tables créées aux
`pgTable` de `src/db/schema.ts` (**32/32**).

## Variables d'environnement attendues en production

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | chaîne Neon (pooler) | oui |
| `DIRECT_URL` | chaîne non poolée, pour le DDL | recommandé |
| `ADMIN_AUTH_SECRET` | ≥ 32 caractères, signature du cookie `/pam` | oui — sans lui, la connexion admin est refusée en production (volontaire) |
| `CRON_SECRET` | ≥ 16 caractères, protège `/api/cron/*` | oui |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | sessions | oui |
| `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET` | paiement abonnement | si SasPay activé |
| `R2_*`, `CLOUDFLARE_ACCOUNT_ID` | stockage images | si upload d'images |
| `SMTP_*`, `MAIL_FROM` | e-mails transactionnels | si e-mails activés |

> `DATABASE_URL` n'apparaît pas dans le projet Vercel `posmarket` (seules les
> clés R2 y figurent). Si la production fonctionne, la chaîne est donc définie
> ailleurs — projet Vercel en pause de l'ancien compte, ou base liée via
> l'intégration Neon. À clarifier : c'est le principal risque de divergence entre
> l'environnement déployé et ce dépôt.

## État constaté le 2026-11-02

Bascule effectuée depuis un poste Windows (`D:\PosMarket`) avec la chaîne Neon
fournie. Sortie du script :

```
• transport : Neon serverless (HTTPS)
= 0025_saspay_subscriptions.sql — déjà appliquée
= 0026_boost_flags.sql          — déjà appliquée
= 0027_review_authors.sql       — déjà appliquée
= 0028_boost_v2.sql             — déjà appliquée
= 0029_boost_logs_voided.sql    — déjà appliquée
✔ 0030_api_rate_limits.sql      appliquée (2 instructions)
✔ 0031_push_tokens.sql          appliquée (2 instructions)
✔ 0032_guest_push_tokens.sql    appliquée (5 instructions)
✔ 0033_orders_buyer_phone.sql   appliquée (2 instructions)
```

**Base à jour.** Les cinq migrations déjà présentes confirment au passage que
les renommages `0019→0026` … `0023→0030` ne désignent bien qu'un seul et même
objet : le contenu avait été joué, pas le nom.

### Ce que cela débloque

| Objet | Fonctionnalité jusque-là inerte |
|---|---|
| `api_rate_limits` | quota partagé entre instances (connexion, encaissement, admin) |
| `push_tokens` | notifications push vendeur |
| `guest_push_tokens` | suivi de commande pour un acheteur sans compte |
| `orders.buyer_phone` | vérification du téléphone lors de l'enregistrement d'un jeton invité |

### Note Windows / PowerShell

`export VAR=…` est une syntaxe Bash : sous PowerShell, elle échoue
(`Le terme « export » n'est pas reconnu`). Le script a fonctionné quand même
parce qu'il lit `.env.local` / `.env`. Les équivalents :

```powershell
$env:DATABASE_URL = 'postgresql://…'   # pour la session courante
npm run db:apply:dry
```

```powershell
# ou, une seule commande, sans variable persistante :
$env:DATABASE_URL='postgresql://…'; npm run db:apply
```

Et dans `.env.local` (jamais commité — `.env*` est déjà dans `.gitignore`) :

```
DATABASE_URL="postgresql://…"
```

### Vérification après coup

```bash
# aucune migration restante attendue
npm run db:apply:dry
```

Ou, côté application : `GET /api/cron/schema-check` doit maintenant renvoyer
`{"ok":true,"missing":[],"checked":21}`.
