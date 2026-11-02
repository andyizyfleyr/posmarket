#!/usr/bin/env node
/**
 * « Mes fichiers locaux sont-ils identiques à GitHub ? »
 *
 * Répond sans rien modifier : ce script ne fait que `fetch` (lecture) et des
 * comparaisons. Aucun `pull`, aucun `reset`, aucune écriture.
 *
 * Il distingue quatre situations que l'on confond facilement :
 *
 *   1. commits locaux non poussés      → `git push`
 *   2. commits distants non récupérés  → `git pull`
 *   3. modifications non committées     → `git status` / `git stash`
 *   4. fichiers modifiés *en local* mais identiques au distant (mtime différent)
 *      → c'est le piège : `git status` les voit, `git diff` est vide. Cas typique
 *      après un `git clone` sur Windows, ou une copie de fichier à l'identique.
 *
 * Usage :
 *   node scripts/sync-status.mjs              # état de la branche courante
 *   node scripts/sync-status.mjs --all        # + toutes les branches distantes
 *   node scripts/sync-status.mjs --files      # + liste des fichiers divergents
 *   node scripts/sync-status.mjs --remote=origin --branch=main
 *
 * Code de sortie : 0 si tout est synchronisé, 1 sinon (utilisable en CI).
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const showFiles = args.includes('--files');
const remoteArg = args.find((a) => a.startsWith('--remote='));
const branchArg = args.find((a) => a.startsWith('--branch='));
const remote = remoteArg ? remoteArg.split('=')[1] : 'origin';

/** Exécute git et renvoie stdout (chaîne vide si la commande échoue). */
function git(...cmd) {
  return gitRaw(...cmd).trim();
}

/**
 * Variante SANS `.trim()`.
 *
 * Indispensable pour `git status --porcelain` : la première colonne du format
 * v1 vaut un ESPACE quand l'index est propre («  M fichier »). Un `trim()` sur
 * la sortie complète supprime ce caractère, décale les colonnes et fait passer
 * tout fichier modifié pour un fichier indexé.
 */
function gitRaw(...cmd) {
  try {
    return execFileSync('git', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

const C = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  gray: '\u001b[90m',
  cyan: '\u001b[36m',
};

const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const ko = (m) => console.log(`${C.red}✗${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const dim = (m) => console.log(`${C.gray}${m}${C.reset}`);

/* ── 0. Contexte ─────────────────────────────────────────────────────── */

const inRepo = git('rev-parse', '--is-inside-work-tree') === 'true';
if (!inRepo) {
  console.error(`${C.red}✗${C.reset} Ce dossier n'est pas un dépôt git.`);
  process.exit(1);
}

const branch = branchArg ? branchArg.split('=')[1] : git('rev-parse', '--abbrev-ref', 'HEAD');
const upstream = `${remote}/${branch}`;

console.log(`${C.bold}Dépôt${C.reset}   ${process.cwd()}`);
console.log(`${C.bold}Branche${C.reset}  ${branch}  ${C.gray}(référence : ${upstream})${C.reset}`);

/* ── 1. Récupérer l'état du distant (lecture seule) ──────────────────── */

const fetchOk = (() => {
  try {
    execFileSync('git', ['fetch', remote, '--prune', '--quiet'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

if (!fetchOk) {
  warn(`Impossible de contacter ${remote} : les comparaisons portent sur la dernière image connue.`);
}

const hasUpstream = git('rev-parse', '--verify', '--quiet', upstream) !== '';
if (!hasUpstream) {
  warn(`La branche « ${branch} » n'existe pas sur ${remote}. Rien n'a encore été poussé.`);
}

/* ── 2. Les quatre comparaisons ──────────────────────────────────────── */

const localHead = git('rev-parse', 'HEAD');
const remoteHead = hasUpstream ? git('rev-parse', upstream) : '';

const ahead = hasUpstream ? Number(git('rev-list', '--count', `${upstream}..HEAD`)) : 0;
const behind = hasUpstream ? Number(git('rev-list', '--count', `HEAD..${upstream}`)) : 0;

/*
 * `git status --porcelain=v1 -uall` :
 *   XY = index + arbre de travail, `??` = non suivi.
 * On sépare les vraies modifications des simples changements de mode/date.
 */
const statusLines = gitRaw('status', '--porcelain=v1', '-uall', '--', '.')
  .split('\n')
  .filter((line) => line.length > 0);

const untracked = statusLines.filter((l) => l.startsWith('??'));
const tracked = statusLines.filter((l) => !l.startsWith('??'));

/*
 * Format porcelain v1 : deux colonnes « XY ».
 *   X = index (index ↔ HEAD)      Y = arbre de travail (worktree ↔ index)
 *   ' ' = inchangé
 * Un fichier modifié puis non ajouté est « ' M' » (X vide) : il ne doit donc
 * PAS être compté comme indexé. Un fichier « MM » est les deux à la fois.
 */
const staged = tracked.filter((l) => l[0] !== ' ' && l[0] !== '?');
const unstaged = tracked.filter((l) => l[1] !== ' ');

/*
 * Le piège : un fichier apparaît modifié alors que son CONTENU est identique à
 * celui du distant. C'est un changement de métadonnées (permissions, mtime après
 * copie). On le détecte en comparant le fichier de travail au blob du commit.
 */
const metadataOnly = [];
const crlfOnly = [];

/*
 * Pour chaque fichier « modifié », on cherche la CAUSE réelle :
 *   - `git diff` vide                → métadonnées (mode, dates)
 *   - diff vide en ignorant le CR     → fins de ligne seules (cas Windows)
 *   - sinon                           → vraie modification de contenu
 */
const reallyChanged = [];
for (const line of unstaged) {
  const file = line.slice(3).replace(/^"|"$/g, '');
  if (!file || file.includes(' -> ')) continue;
  if (git('diff', '--', file) === '') {
    metadataOnly.push(file);
    continue;
  }
  if (git('diff', '--ignore-cr-at-eol', '--', file) === '') {
    crlfOnly.push(file);
    continue;
  }
  reallyChanged.push(file);
}

/* ── 3. Rapport ──────────────────────────────────────────────────────── */

console.log('');
console.log(`${C.bold}Commits${C.reset}`);
console.log(`  local   ${localHead.slice(0, 8)}  ${git('log', '-1', '--format=%s', localHead).slice(0, 60)}`);
if (hasUpstream) {
  console.log(`  ${remote.padEnd(7)} ${remoteHead.slice(0, 8)}  ${git('log', '-1', '--format=%s', remoteHead).slice(0, 60)}`);
}

console.log('');
console.log(`${C.bold}Comparaison${C.reset}`);

let problems = 0;

if (!hasUpstream) {
  problems += 1;
} else if (ahead === 0 && behind === 0 && remoteHead === localHead) {
  ok('Les commits sont identiques : rien à pousser, rien à récupérer.');
} else {
  if (ahead > 0) {
    problems += 1;
    ko(`${ahead} commit(s) local(aux) pas encore sur ${remote} → ${C.cyan}git push${C.reset}`);
    for (const line of git('log', '--oneline', `${upstream}..HEAD`).split('\n').slice(0, 5)) {
      dim(`    ${line}`);
    }
  }
  if (behind > 0) {
    problems += 1;
    ko(`${behind} commit(s) sur ${remote} pas encore en local → ${C.cyan}git pull${C.reset}`);
    for (const line of git('log', '--oneline', `HEAD..${upstream}`).split('\n').slice(0, 5)) {
      dim(`    ${line}`);
    }
  }
  if (ahead > 0 && behind > 0) {
    warn('Les deux côtés ont divergé : `git pull --rebase` avant de pousser.');
  }
}

console.log('');
console.log(`${C.bold}Fichiers${C.reset}`);

if (tracked.length === 0 && untracked.length === 0) {
  ok('Aucun fichier non committé : l\'arbre de travail est propre.');
} else {
  if (staged.length > 0) {
    problems += 1;
    ko(`${staged.length} fichier(s) dans l'index, en attente de commit`);
    if (showFiles) staged.slice(0, 20).forEach((l) => dim(`    ${l}`));
  }
  if (unstaged.length > 0) {
    if (reallyChanged.length > 0) {
      problems += 1;
      ko(`${reallyChanged.length} fichier(s) modifié(s) non committé(s)`);
      if (showFiles) reallyChanged.slice(0, 20).forEach((f) => dim(`    ${f}`));
    }
    if (crlfOnly.length > 0) {
      problems += 1;
      ko(
        `${crlfOnly.length} fichier(s) ne diffèrent QUE par les fins de ligne (CRLF Windows vs LF).`,
      );
      if (showFiles) crlfOnly.slice(0, 20).forEach((f) => dim(`    ${f}`));
      dim('    → cause n°1 des faux « tout est modifié » sous Windows.');
      dim('    → corriger une fois pour toutes :');
      dim('        git config core.autocrlf true     (Windows, recommandé)');
      dim('        git add --renormalize .           puis committer');
      dim('    → ne PAS committer ces fichiers en l\'état : GitHub verrait');
      dim('      l\'intégralité du fichier changer à cause des \\r.');
    }
    if (metadataOnly.length > 0) {
      warn(
        `${metadataOnly.length} fichier(s) marqué(s) modifié(s) mais de contenu IDENTIQUE ` +
          `(métadonnées seules : mode, dates).`,
      );
      if (showFiles) metadataOnly.slice(0, 20).forEach((f) => dim(`    ${f}`));
      dim('    → sans incidence sur GitHub. `git diff` est vide : c\'est normal.');
    }
  }
  if (untracked.length > 0) {
    warn(`${untracked.length} fichier(s) non suivi(s) par git (absents de GitHub)`);
    if (showFiles) untracked.slice(0, 20).forEach((l) => dim(`    ${l}`));
    dim('    → à ajouter (git add) ou à ignorer (.gitignore).');
  }
}

/* ── 4. Toutes les branches, si demandé ──────────────────────────────── */

if (showAll) {
  console.log('');
  console.log(`${C.bold}Branches distantes${C.reset}`);
  const refs = git('for-each-ref', '--format=%(refname:short)|%(objectname:short)', `refs/remotes/${remote}`)
    .split('\n')
    .filter((l) => l && !l.endsWith('HEAD'));
  for (const ref of refs) {
    const [name, sha] = ref.split('|');
    const shortName = name.replace(`${remote}/`, '');
    if (shortName === branch) continue;
    const aheadOf = Number(git('rev-list', '--count', `${remote}/${shortName}..HEAD`));
    const behindOf = Number(git('rev-list', '--count', `HEAD..${remote}/${shortName}`));
    const tag = aheadOf === 0 && behindOf === 0 ? 'identique à HEAD' : `+${aheadOf} / -${behindOf}`;
    dim(`  ${shortName.padEnd(36)} ${sha}  ${tag}`);
  }
}

/* ── 5. Verdict ──────────────────────────────────────────────────────── */

console.log('');
if (problems === 0) {
  console.log(`${C.green}${C.bold}→ Tout est synchronisé.${C.reset} Local et ${upstream} sont identiques.`);
  process.exit(0);
}

console.log(`${C.yellow}${C.bold}→ Il reste ${problems} point(s) à traiter${C.reset} (voir ci-dessus).`);
dim('Rappel : ce script n\'a RIEN modifié. Les commandes proposées sont à lancer à la main.');
process.exit(1);
