import { readFileSync } from 'node:fs';

/**
 * Découpe un fichier SQL en statements individuels.
 *
 * Gère les chaînes entre apostrophes, les blocs dollar-quotés ($$ ... $$) et
 * les commentaires `--` (les apostrophes d'un commentaire ne doivent pas
 * compter comme un guillemet ouvrant). Indispensable : Neon refuse plusieurs
 * commandes dans une requête préparée, et un simple split(';') casse.
 */
export function splitSqlStatements(text) {
  const source = text.replace(/\\\r?\n/g, ' ');
  const statements = [];
  let buffer = '';
  let inSingle = false;
  let inComment = false;
  let dollarTag = null;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inComment) {
      if (ch === '\n') {
        inComment = false;
        buffer += ch;
      }
      continue;
    }

    if (dollarTag) {
      buffer += ch;
      if (ch === '$' && source.startsWith(dollarTag, i)) {
        buffer += source.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }

    if (!inSingle && ch === '-' && source[i + 1] === '-') {
      inComment = true;
      i += 1;
      continue;
    }

    if (!inSingle && ch === '$') {
      const match = source.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (match) {
        dollarTag = match[0];
        buffer += match[0];
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (ch === "'") inSingle = !inSingle;

    if (ch === ';' && !inSingle) {
      const stmt = buffer.trim();
      if (stmt) statements.push(stmt);
      buffer = '';
      continue;
    }

    buffer += ch;
  }

  const tail = buffer.trim();
  if (tail) statements.push(tail);
  return statements;
}

export function readSqlStatements(file) {
  return splitSqlStatements(readFileSync(file, 'utf8'));
}

/**
 * Exécute chaque statement d'un fichier un par un.
 * `tolerate` liste les motifs d'erreur à ignorer (rejeu de migration).
 */
export async function runSqlFile(sql, file, { tolerate = ['already exists', 'duplicate key'] } = {}) {
  const statements = readSqlStatements(file);
  console.log(`\n▶ ${file} (${statements.length} statements)`);
  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 70);
    try {
      await sql([stmt]);
      console.log('  ✅', label);
    } catch (error) {
      const message = error?.message || String(error);
      if (tolerate.some((pattern) => message.includes(pattern))) {
        console.log('  ⚠️  ignoré:', label);
        continue;
      }
      console.error('  ❌', label, '\n   ', message);
      process.exit(1);
    }
  }
}
