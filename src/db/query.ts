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
      }
      return { data: newOrder.id, error: null };
    }

    return { data: null, error: { message: `RPC '${name}' not implemented` } };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function runQuery(spec: QuerySpec): Promise<QueryResult> {
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

    // ---------- DELETE ----------
    if (spec.method === 'delete') {
      await db.delete(table).where(conditions.length ? and(...conditions) : undefined);
      revalidateCatalog(spec.table);
      return { data: null, error: null };
    }

    // ---------- INSERT / UPSERT ----------
    if (spec.method === 'insert' || spec.method === 'upsert') {
      const dbRows = toDbValues(spec.values, columns);
      if (spec.method === 'upsert') {
        const setObj: Record<string, unknown> = {};
        const firstRow = Array.isArray(dbRows)
          ? (dbRows[0] as Record<string, unknown>)
          : (dbRows as Record<string, unknown>);
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
      await db.update(table).set(dbValues as never).where(conditions.length ? and(...conditions) : undefined);
      revalidateCatalog(spec.table);
      return { data: null, error: null };
    }

    // ---------- SELECT ----------
    if (spec.textSearch?.query) {
      const info = columns.get(spec.textSearch.column) || columns.get('name');
      if (info) {
        conditions.push(sql`${info.col} ILIKE ${'%' + spec.textSearch.query + '%'}`);
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