import { eq, and, inArray, desc, asc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core';
import { revalidatePath, updateTag } from 'next/cache';
import { db } from './index';
import * as schema from './schema';
import { QuerySpec, QueryResult, QueryBuilder } from './builder';

export * from './builder';
export { QueryBuilder };

const tableRegistry: Record<string, AnyPgTable> = {
  profiles: schema.profiles,
  stores: schema.stores,
  categories: schema.categories,
  products: schema.products,
  customers: schema.customers,
  orders: schema.orders,
  order_items: schema.orderItems,
  invoices: schema.invoices,
  invoice_items: schema.invoiceItems,
  product_stats: schema.productStats,
  coupons: schema.coupons,
  product_reviews: schema.productReviews,
  store_staff: schema.storeStaff,
  store_stats: schema.storeStats,
  buyer_addresses: schema.buyerAddresses,
};

type ColumnInfo = { col: PgColumn; key: string };

function isColumn(value: unknown): value is PgColumn {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as { name?: unknown }).name === 'string';
}

function getTable(tableName: string): AnyPgTable | null {
  return tableRegistry[tableName] || null;
}

type DynamicTable = AnyPgTable & { id: PgColumn };

function getColumnInfo(table: AnyPgTable): Map<string, ColumnInfo> {
  const map = new Map<string, ColumnInfo>();
  for (const [key, col] of Object.entries(table)) {
    if (isColumn(col)) {
      const info: ColumnInfo = { col, key };
      map.set(key, info);
      map.set(col.name, info);
    }
  }
  return map;
}

function toDbValues(values: unknown, columns: Map<string, ColumnInfo>): unknown {
  if (Array.isArray(values)) {
    return values.map((v) => toDbValues(v, columns));
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    const info = columns.get(key);
    if (info) {
      out[info.key] = value;
    }
  }
  return out;
}

function toSnake(table: AnyPgTable, row: Record<string, unknown>): Record<string, unknown> {
  if (row == null) return row;
  const columns = getColumnInfo(table);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const info = columns.get(key);
    out[info ? info.col.name : key] = value;
  }
  return out;
}

function toSnakeRows(table: AnyPgTable, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return (rows || []).map((r) => toSnake(table, r));
}

const CATALOG_TABLES = new Set(['stores', 'products']);

/**
 * Périmètre imposé par l'appelant.
 *
 * `runQuery` est aussi exposé comme server action (`src/app/actions/sql.ts`) :
 * sans périmètre, une requête `delete` sans filtre vide la table entière. Le
 * périmètre est donc appliqué ici, au plus près de la construction du `where`,
 * et non seulement dans l'action.
 */
export type QueryScope = {
  /** Restreint les lignes accessibles à ces boutiques (colonne `store_id`). */
  storeIds?: string[] | null;
  /** Refuse `update`/`delete` sans aucun filtre (protection contre l'écriture globale). */
  requireFilterForWrite?: boolean;
};

function deny(message: string): QueryResult {
  return { data: null, error: { message } };
}


function revalidateCatalog(table: string) {
  if (!CATALOG_TABLES.has(table)) return;
  try {
    updateTag('marketplace');
    revalidatePath('/store');
  } catch {
    // ignore: called outside action/route context
  }
}

async function runRpc(name: string, argsRaw: unknown): Promise<QueryResult> {
  const args = (argsRaw && typeof argsRaw === 'object' ? argsRaw : {}) as Record<string, unknown>;
  try {
    if (name === 'increment_product_views') {
      const pId = args.p_id ? String(args.p_id) : undefined;
      if (pId) {
        await db
          .update(schema.products)
          .set({ views: sql`${schema.products.views} + 1` })
          .where(eq(schema.products.id, pId));
      }
      revalidateCatalog('products');
      return { data: null, error: null };
    }

    if (name === 'increment_store_views') {
      const pId = args.p_id ? String(args.p_id) : undefined;
      if (pId) {
        await db
          .update(schema.stores)
          .set({ views: sql`${schema.stores.views} + 1` })
          .where(eq(schema.stores.id, pId));
      }
      revalidateCatalog('stores');
      return { data: null, error: null };
    }

    if (name === 'get_user_id_by_email') {
      const email = args.p_email ? String(args.p_email) : '';
      if (!email) return { data: null, error: null };
      const [profile] = await db
        .select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(eq(schema.profiles.email, email))
        .limit(1);
      return { data: profile?.id || null, error: null };
    }

    if (name === 'create-staff') {
      const body = args || {};
      const email = String(body.email || '');
      const role = String(body.role || 'SELLER');
      const storeId = body.storeId || body.store_id;
      const permissions = body.permissions || {};

      let [profile] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.email, email))
        .limit(1);
      if (!profile) {
        [profile] = await db
          .insert(schema.profiles)
          .values({ email, fullName: String(body.name || '') || email?.split('@')[0] || 'Staff' } as never)
          .returning();
      }

      if (storeId) {
        await db
          .insert(schema.storeStaff)
          .values({ storeId: String(storeId), userId: profile.id, role, permissions } as never)
          .onConflictDoNothing();
      }

      return { data: { ok: true, userId: profile.id }, error: null };
    }

    if (name === 'create_order_full') {
      const orderData = (args?.p_order || {}) as Record<string, unknown>;
      const items = Array.isArray(args?.p_items)
        ? (args.p_items as Array<Record<string, unknown>>)
        : [];
      const [newOrder] = await db
        .insert(schema.orders)
        .values({
          storeId: String(orderData.store_id || ''),
          customerId: orderData.customer_id ? String(orderData.customer_id) : null,
          date: orderData.date ? new Date(String(orderData.date)) : new Date(),
          status: String(orderData.status || 'PENDING'),
          paymentMethod: String(orderData.payment_method || 'ESPECES'),
          type: String(orderData.type || 'IN_STORE'),
          promoCode: orderData.promo_code ? String(orderData.promo_code) : null,
          subtotal: String(orderData.subtotal ?? 0),
          total: String(orderData.total ?? 0),
          discountAmount: String(orderData.discount_amount ?? 0),
        } as never)
        .returning();

      if (items.length > 0) {
        await db.insert(schema.orderItems).values(
          items.map((item) => ({
            orderId: newOrder.id,
            productId: item.product_id ? String(item.product_id) : null,
            quantity: Number(item.quantity) || 0,
            unitPrice: String(item.price ?? 0),
            total: String((Number(item.price) || 0) * (Number(item.quantity) || 0)),
          })) as never
        );

        const salesTotals = new Map<string, number>();
        for (const item of items) {
          const pid = item.product_id ? String(item.product_id) : null;
          if (!pid) continue;
          const qty = Math.floor(Number(item.quantity) || 0);
          if (qty <= 0) continue;
          salesTotals.set(pid, (salesTotals.get(pid) || 0) + qty);
        }
        for (const [productId, qty] of salesTotals) {
          await db
            .insert(schema.productStats)
            .values({ storeId: String(orderData.store_id || ''), productId, totalSales: qty })
            .onConflictDoUpdate({
              target: schema.productStats.productId,
              set: { totalSales: sql`${schema.productStats.totalSales} + ${qty}` },
            });
        }
      }
      return { data: newOrder.id, error: null };
    }

    return { data: null, error: { message: `RPC '${name}' not implemented` } };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function runQuery(spec: QuerySpec, scope?: QueryScope): Promise<QueryResult> {
  if (spec.rpc) {
    return runRpc(spec.rpc, spec.rpcArgs);
  }

  const table = getTable(spec.table);
  if (!table) {
    return { data: null, error: { message: `Table '${spec.table}' not found` } };
  }
  const columns = getColumnInfo(table);

  try {
    const conditions: SQL<unknown>[] = [];
    for (const f of spec.filters || []) {
      const info = columns.get(f.column);
      if (!info) continue;
      if (f.op === 'eq') conditions.push(eq(info.col, f.value as never));
      else if (f.op === 'in') conditions.push(inArray(info.col, f.value as never[]));
    }

    // Périmètre boutique : ajouté au `where`, donc impossible à contourner en
    //	forgeant des filtres depuis le client.
    if (scope?.storeIds) {
      const storeCol = columns.get('storeId');
      if (!storeCol) return deny('Périmètre boutique inapplicable à cette table');
      if (scope.storeIds.length === 0) {
        // Aucune boutique gérable : on ne doit toucher aucune ligne.
        return { data: null, error: null, count: 0 };
      }
      conditions.push(inArray(storeCol.col, scope.storeIds as never[]));
    }

    const isWrite = spec.method !== 'select';
    if (isWrite && scope?.requireFilterForWrite && conditions.length === 0) {
      return deny('Refusé : une écriture sans filtre modifierait toutes les lignes');
    }

    // ---------- DELETE ----------
    if (spec.method === 'delete') {
      await db.delete(table).where(conditions.length ? and(...conditions) : undefined);
      revalidateCatalog(spec.table);
      return { data: null, error: null };
    }

    // ---------- INSERT / UPSERT ----------
    if (spec.method === 'insert' || spec.method === 'upsert') {
      const dbRows = toDbValues(spec.values, columns);
      const rows: Array<Record<string, unknown>> = Array.isArray(dbRows)
        ? (dbRows as Array<Record<string, unknown>>)
        : [dbRows as Record<string, unknown>];

      if (scope?.storeIds) {
        const storeCol = columns.get('storeId');
        if (!storeCol) return deny('Périmètre boutique inapplicable à cette table');
        const allowed = new Set(scope.storeIds as string[]);
        const idCol = columns.get('id');

        for (const row of rows) {
          // Un INSERT n'a pas de `where` : le `store_id` fourni par le client
          // doit être vérifié, sinon il permet d'écrire dans n'importe quelle
          // boutique en connaissant son identifiant.
          const providedStore = row[storeCol.key];
          if (providedStore != null && !allowed.has(String(providedStore))) {
            return deny("Vous n'avez pas accès à cette boutique");
          }

          // `onConflictDoUpdate` ignore le `where` : sans cette vérification, un
          // vendeur pourrait réécrire une ligne existante d'une autre boutique
          // en forgeant son `id`.
          const rowId = idCol ? row[idCol.key] : undefined;
          if (rowId) {
            const [existing] = await db
              .select({ storeId: storeCol.col })
              .from(table as AnyPgTable)
              .where(eq((table as DynamicTable).id, rowId as never))
              .limit(1);
            if (!existing) return deny('Ligne introuvable ou déjà supprimée');
            if (!allowed.has(String(existing.storeId))) {
              return deny("Vous n'avez pas accès à cette ressource");
            }
          } else if (spec.method === 'upsert' && !idCol) {
            return deny('Refusé : mise à jour sans identifiant de ligne');
          }
        }
      }

      if (spec.method === 'upsert') {
        const setObj: Record<string, unknown> = {};
        const firstRow = rows[0] || {};
        for (const [key, value] of Object.entries(firstRow)) {
          if (key !== 'id') setObj[key] = value;
        }
        await db
          .insert(table)
          .values(dbRows as never)
          .onConflictDoUpdate({ target: (table as DynamicTable).id, set: setObj as never });
      } else {
        await db.insert(table).values(dbRows as never);
      }
      revalidateCatalog(spec.table);
      return { data: null, error: null };
    }

    // ---------- UPDATE ----------
    if (spec.method === 'update') {
      const dbValues = toDbValues(spec.values, columns);
      // Le `where` borne les lignes touchées, mais pas la valeur écrite : sans
      // ce contrôle, un vendeur could déplacer une ligne vers une autre boutique.
      if (scope?.storeIds) {
        const storeCol = columns.get('storeId');
        const nextStore = storeCol ? (dbValues as Record<string, unknown>)[storeCol.key] : undefined;
        if (nextStore != null && !(scope.storeIds as string[]).includes(String(nextStore))) {
          return deny("Vous n'avez pas accès à cette boutique");
        }
      }
      await db.update(table).set(dbValues as never).where(conditions.length ? and(...conditions) : undefined);
      revalidateCatalog(spec.table);
      return { data: null, error: null };
    }

    // ---------- SELECT ----------
    if (spec.textSearch?.query) {
      const nameInfo = columns.get('name');
      const vectorInfo = columns.get('searchVector') || columns.get('search_vector');
      const queryTerm = spec.textSearch.query.trim().replace(/\s+/g, ' ');

      if (nameInfo) {
        const conditions_parts: SQL<unknown>[] = [];

        // FTS via search_vector generated column (preferred — uses GIN index)
        if (vectorInfo) {
          conditions_parts.push(
            sql`${vectorInfo.col} @@ websearch_to_tsquery('french', ${queryTerm})`
          );
        }

        // pg_trgm fuzzy match on name (GIN trgm index) — catches typos
        conditions_parts.push(sql`${nameInfo.col} % ${queryTerm}`);

        // ILIKE fallback for partial matches on very short terms
        conditions_parts.push(sql`${nameInfo.col} ILIKE ${'%' + queryTerm + '%'}`);

        conditions.push(sql`(${sql.join(conditions_parts, sql` OR `)})`);
      }
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    if (spec.head) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(table).where(whereClause);
      return { data: [], error: null, count: Number(count) };
    }

    const selectedCols = spec.selectColumns && spec.selectColumns.length > 0;
    let selectObj: Record<string, PgColumn> | null = null;
    if (selectedCols) {
      selectObj = {};
      for (const name of spec.selectColumns!) {
        const info = columns.get(name);
        if (info) selectObj[info.key] = info.col;
      }
    }

    const base = selectedCols
      ? db.select(selectObj!).from(table).where(whereClause)
      : db.select().from(table).where(whereClause);

    if (spec.order?.column) {
      const info = columns.get(spec.order.column);
      if (info) {
        base.orderBy(spec.order.ascending === false ? desc(info.col) : asc(info.col));
      }
    } else if (spec.textSearch?.query) {
      const nameInfo = columns.get('name');
      const vectorInfo = columns.get('searchVector') || columns.get('search_vector');
      const queryTerm = spec.textSearch.query.trim().replace(/\s+/g, ' ');
      if (vectorInfo && nameInfo) {
        // Weighted rank: FTS ts_rank × 2 + trigram similarity on name × 1.5
        base.orderBy(sql`
          (ts_rank(${vectorInfo.col}, websearch_to_tsquery('french', ${queryTerm})) * 2.0
          + similarity(${nameInfo.col}::text, ${queryTerm}) * 1.5) DESC
        `);
      } else if (nameInfo) {
        base.orderBy(sql`similarity(${nameInfo.col}::text, ${queryTerm}) DESC`);
      }
    }


    if (spec.limit != null) base.limit(spec.limit);
    if (spec.offset != null) base.offset(spec.offset);

    const rows = await base;

    if (spec.single) {
      const row = rows[0] || null;
      return { data: row ? toSnake(table, row) : null, error: row ? null : { message: 'Row not found' } };
    }

    return { data: toSnakeRows(table, rows), error: null, count: rows.length };
  } catch (e) {
    return { data: null, error: e };
  }
}