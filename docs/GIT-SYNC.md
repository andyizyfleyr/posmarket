# Savoir si le local et GitHub sont à jour

Trois niveaux de réponse, du plus rapide au plus complet.

## 1. La commande unique (recommandée)

```bash
npm run sync:check
```

ou, sans passer par npm :

```bash
node scripts/sync-status.mjs --files
```

Le script **ne modifie rien** : il fait un `git fetch` (lecture) et compare.
Il distingue quatre situations qu'on confond facilement :

| Symptôme affiché | Signification | Commande |
|---|---|---|
| `N commit(s) local(aux) pas encore sur origin` | travail commité, pas poussé | `git push` |
| `N commit(s) sur origin pas encore en local` | GitHub a avancé | `git pull --rebase` |
| `N fichier(s) modifié(s) non committé(s)` | travail en cours | `git add` + commit |
| `ne diffèrent QUE par les fins de ligne` | **faux positif Windows** (CRLF ↔ LF) | voir § 4 |
| `marqué(s) modifié(s) mais de contenu IDENTIQUE` | permissions/dates seules | rien à faire |
| `fichier(s) non suivi(s)` | jamais ajouté à git | `git add` ou `.gitignore` |

Code de sortie : `0` si tout est synchronisé, `1` sinon — utilisable dans un
script ou un hook.

```bash
node scripts/sync-status.mjs            # branche courante
node scripts/sync-status.mjs --all      # + toutes les branches distantes
node scripts/sync-status.mjs --files    # + la liste des fichiers concernés
node scripts/sync-status.mjs --branch=main
```

## 2. Les commandes git seules (sans le script)

```bash
git fetch origin          # met à jour l'image du distant (ne touche à rien)
git status -sb            # 2 premières lignes : branche + avance/retard
```

La première ligne de `git status -sb` suffit dans 90 % des cas :

```
## main...origin/main [ahead 2, behind 1]
```

- `ahead 2` → 2 commits locaux pas sur GitHub
- `behind 1` → 1 commit GitHub pas en local
- rien → identique

Pour les fichiers :

```bash
git status --short        # XY fichier
git diff --stat           # ce qui changerait
git diff --ignore-cr-at-eol --stat   # en ignorant les fins de ligne
```

## 3. Comparer un fichier précis, sans rien télécharger

```bash
# Contenu du fichier tel qu'il est sur GitHub (branche main)
git show origin/main:chemin/du/fichier.txt

# Différence entre mon fichier local et celui de GitHub
git diff origin/main -- chemin/du/fichier.txt
```

Et l'empreinte globale de l'arbre (même valeur = strictement identique) :

```bash
git rev-parse HEAD^{tree}          # mon arbre
git rev-parse origin/main^{tree}   # l'arbre de GitHub
```

## 4. Le piège Windows : CRLF contre LF

C'est **la** cause des « tout est modifié » qui n'en finissent pas : sous
Windows, un éditeur enregistre les fins de ligne en `\r\n`, alors que le dépôt
stocke en `\n`. Git voit alors chaque ligne changer.

Diagnostic :

```bash
git diff --ignore-cr-at-eol --stat      # vide → ce sont bien les fins de ligne
git status --short | wc -l              # compare avec la ligne au-dessus
```

Correctif définitif, une seule fois :

```bash
git config core.autocrlf true     # Windows : convertit à l'entrée/sortie
git add --renormalize .           # réécrit l'index en LF
git commit -m "chore: normaliser les fins de ligne"
```

Ne **pas** committer ces fichiers en l'état : GitHub verrait le fichier entier
changer, et le diff deviendrait illisible pour toute l'équipe.

Le dépôt contient désormais un `.gitattributes` qui impose `eol=lf` partout
(sauf `*.bat`/`*.cmd`/`*.ps1` en CRLF, et les binaires). Combiné à
`core.autocrlf true` côté Windows, les fichiers récupérés sont identiques
octet pour octet à ceux de GitHub.

> Déjà rencontré : un test qui découpait `globals.css` sur `'\n}\n'` passait
> sous Linux et échouait sous Windows (`indexOf` renvoyait `-1`, donc un bloc de
> 2 caractères). Le code testé était correct ; c'est le test qui était fragile.
> Tout test qui lit un fichier source doit normaliser les fins de ligne.

## 5. Et le dossier `node_modules` ?

Il est dans `.gitignore`, donc absent de GitHub par construction : son contenu
n'a pas à être comparé. C'est aussi pourquoi `npm ci` est nécessaire après un
clone.

De même, tout ce que liste `git check-ignore -v <fichier>` n'est pas censé
partir sur GitHub (`.next/`, `.env*`, `dist/`…).

## 6. Cas particulier : le déploiement Vercel est-il à jour ?

« Local = GitHub » n'implique pas « production = GitHub » : il faut encore que
le build soit terminé. Vérification :

```bash
gh api repos/andyizyfleyr/posmarket/deployments?per_page=4 \
  --jq '.[] | "\(.sha[0:7]) \(.environment) \(.created_at)"'
```

Le SHA affiché doit être celui de `git rev-parse origin/main`.
