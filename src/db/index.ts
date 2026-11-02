import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { describeDatabaseUrlProblem, normalizeDatabaseUrl } from '@/lib/database-url';

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }

  // La variable est nettoyée avant usage : un copier-coller de la forme
  // `psql 'postgresql://…'` passait tel quel et faisait échouer toutes les
  // requêtes (« not a valid URL »), page par page.
  const connectionString = normalizeDatabaseUrl(raw);
  const problem = describeDatabaseUrlProblem(raw);
  if (problem) {
    // Un seul message clair côté serveur, sans divulguer mot de passe ni hôte.
    throw new Error(`[db] ${problem}`);
  }

  return drizzle(neon(connectionString), { schema });
}

export function getDb() {
  // Une erreur de configuration n'est pas mise en cache : si la variable est
  // corrigée (redéploiement), l'instance suivante repart proprement.
  if (!_db) _db = createDb();
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    const d = getDb();
    const value = Reflect.get(d, prop, receiver);
    return typeof value === 'function' ? value.bind(d) : value;
  },
});
