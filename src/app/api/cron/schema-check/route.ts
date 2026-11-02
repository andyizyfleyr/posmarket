import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/schema-check — confronte la base réelle au schéma attendu.
 *
 * Pourquoi cet endpoint : les migrations de ce dépôt ont longtemps été jouées à
 * la main (`node scripts/apply-migration-*.mjs`). Rien ne garantissait que la
 * base porte la même version que le code. Une colonne manquante ne se voit pas
 * au déploiement : elle se manifeste par une erreur Drizzle (« column … does not
 * exist ») au moment précis où le client clique.
 *
 * On interroge donc `information_schema`/`pg_indexes` depuis l'application
 * elle-même, c'est-à-dire avec les droits et la chaîne de connexion de
 * production. Aucun identifiant n'a besoin de circuler.
 *
 * Accès : en-tête Vercel Cron (`x-vercel-cron`) ou `CRON_SECRET` (Bearer), comme
 * les autres tâches planifiées. La réponse ne contient que des noms de tables et
 * de colonnes, jamais de données.
 */
export async function GET(request: NextRequest) {
  const isVercelCron = Boolean(request.headers.get('x-vercel-cron'));
  if (!isVercelCron && !isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [tableRows, columnRows, indexRows] = await Promise.all([
      db.execute<{ table_name: string }>(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      ),
      db.execute<{ table_name: string; column_name: string }>(
        sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
      ),
      db.execute<{ tablename: string; indexname: string }>(
        sql`SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'`,
      ),
    ]);

    const tables = new Set(tableRows.rows.map((row) => row.table_name));
    const columns = new Set(
      columnRows.rows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    const indexes = new Set(indexRows.rows.map((row) => row.indexname));

    /** Objets introduits par les migrations récentes (0025 → 0033). */
    const expected = [
      { name: 'table review_authors', ok: tables.has('review_authors') },
      { name: 'table boost_logs', ok: tables.has('boost_logs') },
      { name: 'table boost_schedules', ok: tables.has('boost_schedules') },
      { name: 'table api_rate_limits', ok: tables.has('api_rate_limits') },
      { name: 'table push_tokens', ok: tables.has('push_tokens') },
      { name: 'table guest_push_tokens', ok: tables.has('guest_push_tokens') },
      { name: 'table product_variants', ok: tables.has('product_variants') },
      { name: 'table product_variant_snapshots', ok: tables.has('product_variant_snapshots') },
      { name: 'table checkout_idempotency', ok: tables.has('checkout_idempotency') },
      { name: 'table notification_outbox', ok: tables.has('notification_outbox') },
      { name: 'column orders.buyer_phone', ok: columns.has('orders.buyer_phone') },
      { name: 'column orders.boosted', ok: columns.has('orders.boosted') },
      { name: 'column product_reviews.boosted', ok: columns.has('product_reviews.boosted') },
      { name: 'column product_reviews.author_avatar', ok: columns.has('product_reviews.author_avatar') },
      { name: 'column product_reviews.seller_reply', ok: columns.has('product_reviews.seller_reply') },
      { name: 'column stores.boosted_views', ok: columns.has('stores.boosted_views') },
      { name: 'column products.boosted_views', ok: columns.has('products.boosted_views') },
      {
        name: 'column subscription_payments.saspay_checkout_id',
        ok: columns.has('subscription_payments.saspay_checkout_id'),
      },
      {
        name: 'column notification_outbox.recipient_email',
        ok: columns.has('notification_outbox.recipient_email'),
      },
      {
        name: 'column notification_preferences.email',
        ok: columns.has('notification_preferences.email'),
      },
      { name: 'index orders_buyer_phone_idx', ok: indexes.has('orders_buyer_phone_idx') },
    ];

    const missing = expected.filter((item) => !item.ok).map((item) => item.name);

    return NextResponse.json(
      {
        ok: missing.length === 0,
        missing,
        checked: expected.length,
        // Volontairement limité : pas de schéma complet, aucune donnée.
        counts: {
          tables: tables.size,
          columns: columns.size,
          indexes: indexes.size,
        },
      },
      { status: missing.length === 0 ? 200 : 503 },
    );
  } catch (error) {
    console.error(
      '[schema-check] impossible de lire le catalogue de la base:',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json({ ok: false, error: 'db-unreachable' }, { status: 500 });
  }
}
