import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  try {
    const path = join(__dirname, '..', 'drizzle', '0025_guest_push_tokens.sql');
    const q = readFileSync(path, 'utf8');
    const statements = q.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await sql.query(stmt);
    }
    console.log('guest_push_tokens migration applied');
    process.exit(0);
  } catch (e) {
    console.error('migration error:', e);
    process.exit(1);
  }
}

run();
