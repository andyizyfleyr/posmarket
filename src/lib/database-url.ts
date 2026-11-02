/**
 * Normalisation de la chaîne de connexion PostgreSQL.
 *
 * Les tableaux de bord (Vercel, Neon, partages de messages) présentent souvent
 * la chaîne sous forme de commande shell complète :
 *
 *   psql 'postgresql://user:pass@host/db?sslmode=require&channel_binding=require'
 *
 * Collée telle quelle dans une variable d'environnement, elle n'est pas une URL :
 * `neon()` lève alors « Database connection string provided to `neon()` is not a
 * valid URL » à la première requête. Toutes les pages qui lisent la base
 * renvoient alors 500, alors que la variable « existe » — d'où un diagnostic
 * trompeur (on croit à une base en panne).
 *
 * On tolère donc les guillemets, le préfixe `psql`, un éventuel `-c "\dt"`, et
 * on retire les paramètres incompatibles avec les pilotes utilisés ici.
 */

/** Paramètres acceptés par `pg` mais rejetés/handicapants côté Neon serverless. */
const DROP_PARAMS = ['channel_binding'];

export function normalizeDatabaseUrl(raw: string | undefined): string {
  const value = (raw || '').trim();
  if (!value) return '';

  let candidate = value;

  // `psql 'postgres://…'`, `psql -c "…"`, guillemets simples/doubles éventuels.
  candidate = candidate.replace(/^psql\s+/i, '');
  candidate = candidate.replace(/^['"`]/, '').replace(/['"`]$/, '');
  // Espaces résiduels après retrait des guillemets.
  candidate = candidate.trim();

  // Paramètres explicitement postgres, hérités d'un copier-coller `psql`.
  candidate = candidate.replace(/^postgres:\/\//i, 'postgresql://');

  if (DROP_PARAMS.length > 0) {
    try {
      const url = new URL(candidate);
      let changed = false;
      for (const param of DROP_PARAMS) {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
          changed = true;
        }
      }
      if (changed) candidate = url.toString();
    } catch {
      // URL illisible : on renvoie la valeur nettoyée, l'appelant signalera
      // l'erreur avec le message d'origine (plus utile que le nôtre).
    }
  }

  return candidate;
}

/**
 * Message d'erreur sûr : indique la forme du problème sans jamais révéler le
 * mot de passe ni l'hôte.
 */
export function describeDatabaseUrlProblem(raw: string | undefined): string | null {
  const value = (raw || '').trim();
  if (!value) return 'DATABASE_URL est absente.';
  const normalized = normalizeDatabaseUrl(value);
  try {
    const url = new URL(normalized);
    if (!/^postgres(ql)?:$/.test(url.protocol)) {
      return `DATABASE_URL n'est pas une URL PostgreSQL (protocole « ${url.protocol} »).`;
    }
    return null;
  } catch {
    const hasWrapper = /^(psql|['"`])/i.test(value);
    return hasWrapper
      ? "DATABASE_URL contient la commande shell complète (préfixe « psql » ou guillemets) au lieu de la seule URL. Attendu : postgresql://user:motdepasse@hote/base?sslmode=require"
      : "DATABASE_URL n'est pas une URL valide.";
  }
}
