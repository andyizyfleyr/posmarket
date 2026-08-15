import { db } from './index';
import { products, customers, orders, orderItems, stores, profiles, productStats, invoices } from './schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { Product, Customer } from '@/types';

export async function dbFetchStores() {
  return await db.select().from(stores);
}

function toSnakeStore(store: any): any {
  if (!store) return store;
  return {
    id: store.id,
    user_id: store.userId,
    name: store.name,
    slug: store.slug,
    email: store.email,
    phone: store.phone,
    address: store.address,
    ninea: store.ninea,
    description: store.description,
    logo: store.logo,
    theme: store.theme,
    business_type: store.businessType,
    status: store.status,
    views: store.views,
    settings: store.settings || {},
    created_at: store.createdAt,
  };
}

export interface StoreDataFields {
  products?: boolean;
  orders?: boolean;
  customers?: boolean;
  invoices?: boolean;
}

// ---- Orders cache (per store, short TTL, invalidated on writes) ----
const ORDER_CACHE_TTL = 20_000;
const ordersCache = new Map<string, { ts: number; data: { ordersRes: any[]; itemsByOrder: Record<string, any[]> } }>();

export function invalidateOrdersCache(storeId: string | null) {
  if (storeId) ordersCache.delete(`orders:${storeId}`);
}

export async function getStoreIdForOrder(orderId: string): Promise<string | null> {
  const [row] = await db.select({ storeId: orders.storeId }).from(orders).where(eq(orders.id, orderId)).limit(1);
  return row?.storeId || null;
}

async function getOrdersForStore(storeId: string) {
  const key = `orders:${storeId}`;
  const hit = ordersCache.get(key);
  if (hit && Date.now() - hit.ts < ORDER_CACHE_TTL) return hit.data;

  const rows = await db
    .select({
      id: orders.id,
      storeId: orders.storeId,
      customerId: orders.customerId,
      date: orders.date,
      status: orders.status,
      type: orders.type,
      paymentMethod: orders.paymentMethod,
      subtotal: orders.subtotal,
      total: orders.total,
      discountAmount: orders.discountAmount,
      promoCode: orders.promoCode,
      customerName: customers.name,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      customerTotalSpent: customers.totalSpent,
      customerOrdersCount: customers.ordersCount,
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.storeId, storeId))
    .orderBy(desc(orders.date))
    .limit(100);

  const ordersRes = (rows || []).map((o: any) => ({
    id: o.id,
    storeId: o.storeId,
    customerId: o.customerId,
    date: o.date,
    status: o.status,
    type: o.type,
    paymentMethod: o.paymentMethod,
    subtotal: o.subtotal,
    total: o.total,
    discountAmount: o.discountAmount,
    promoCode: o.promoCode,
    customer: o.customerId
      ? {
          id: o.customerId,
          name: o.customerName,
          email: o.customerEmail || '',
          phone: o.customerPhone || '',
          address: o.customerAddress || '',
          totalSpent: o.customerTotalSpent,
          ordersCount: o.customerOrdersCount,
        }
      : undefined,
  }));

  const orderIds = ordersRes.map((o: any) => o.id);

  let itemsByOrder: Record<string, any[]> = {};
  if (orderIds.length > 0) {
    const joinedRows = await db
      .select({
        orderId: orderItems.orderId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        total: orderItems.total,
        productId: orderItems.productId,
        productName: products.name,
        productPrice: products.price,
        productImage: products.image,
        productStoreId: products.storeId,
        productBusinessType: products.businessType,
        productMainCategory: products.mainCategory,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(inArray(orderItems.orderId, orderIds));

    itemsByOrder = (joinedRows || []).reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push({
        product: item.productId
          ? {
              id: item.productId,
              name: item.productName,
              price: item.productPrice != null ? parseFloat(item.productPrice) : 0,
              image: item.productImage,
              storeId: item.productStoreId,
              businessType: item.productBusinessType,
              mainCategory: item.productMainCategory,
            }
          : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      });
      return acc;
    }, {});
  }

  const data = { ordersRes, itemsByOrder };
  ordersCache.set(key, { ts: Date.now(), data });
  return data;
}

function formatOrder(o: any, itemsByOrder: Record<string, any[]>) {
  return {
    id: o.id,
    date: o.date,
    status: o.status,
    type: o.type,
    paymentMethod: o.paymentMethod,
    subtotal: parseFloat(o.subtotal) || 0,
    total: parseFloat(o.total) || 0,
    discountAmount: o.discountAmount ? parseFloat(o.discountAmount) : 0,
    promoCode: o.promoCode,
    customer: o.customer,
    items: itemsByOrder[o.id] || [],
  };
}

export async function fetchFormattedOrders(storeId: string) {
  const { ordersRes, itemsByOrder } = await getOrdersForStore(storeId);
  return (ordersRes || []).map((o: any) => formatOrder(o, itemsByOrder));
}

export async function dbFetchStoreData(storeId: string, ownerId?: string, fields?: StoreDataFields) {
  const needs = {
    products: fields?.products !== false,
    orders: fields?.orders !== false,
    customers: fields?.customers !== false,
    invoices: fields?.invoices !== false,
  };

  const tasks: Promise<any>[] = [
    db.select().from(stores).where(eq(stores.id, storeId)).limit(1),
    needs.products ? db.select().from(products).where(eq(products.storeId, storeId)).limit(200) : Promise.resolve([]),
    needs.orders ? getOrdersForStore(storeId) : Promise.resolve({ ordersRes: [], itemsByOrder: {} }),
    needs.customers ? db.select().from(customers).where(eq(customers.storeId, storeId)).orderBy(desc(customers.createdAt)).limit(100) : Promise.resolve([]),
    needs.invoices ? db.select().from(invoices).where(eq(invoices.storeId, storeId)).limit(100).catch(() => []) : Promise.resolve([]),
    needs.products ? db.select().from(productStats).where(eq(productStats.storeId, storeId)).catch(() => []) : Promise.resolve([]),
    ownerId ? db.select().from(profiles).where(eq(profiles.id, ownerId)).limit(1) : Promise.resolve([])
  ];

  const [
    storeRes,
    productsRes,
    ordersData,
    customersRes,
    invoicesRes,
    statsRes,
    profileRes
  ] = await Promise.all(tasks);

  const store = storeRes[0] || null;
  const { ordersRes, itemsByOrder } = ordersData;
  let profile = profileRes[0] || null;

  if (!profile && ownerId && store?.userId) {
    const [fallbackProfile] = await db.select().from(profiles).where(eq(profiles.id, store.userId)).limit(1);
    profile = fallbackProfile || null;
  }

  const statsMap = Object.fromEntries((statsRes || []).map((s: any) => [s.productId, s]));

  const formattedProducts = (productsRes || []).map((p: any) => {
    const stats = statsMap[p.id] || {};
    return {
      ...p,
      price: parseFloat(p.price) || 0,
      originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : undefined,
      isOnline: p.isOnline !== false,
      salesCount: Number(stats.totalSales) || 0,
      reviewCount: Number(stats.reviewCount) || 0,
      rating: Number(stats.averageRating) || 0,
      views: Number(p.views) || 0,
      wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : undefined,
      wholesaleMinQty: p.wholesaleMinQty,
      mainCategory: p.mainCategory,
      businessType: p.businessType,
      options: p.options || [],
      variants: p.variants || [],
    };
  });

  // Order items are already joined (with customer via LEFT JOIN) in getOrdersForStore
  const formattedOrders = (ordersRes || []).map((o: any) => formatOrder(o, itemsByOrder));

  const formattedCustomers = (customersRes || []).map((c: any) => ({
    ...c,
    totalSpent: parseFloat(c.totalSpent) || 0,
    ordersCount: Number(c.ordersCount) || 0,
  }));

  return {
    store: toSnakeStore(store),
    products: formattedProducts,
    orders: formattedOrders,
    customers: formattedCustomers,
    invoices: invoicesRes || [],
    profile,
  };
}

export async function dbCreateStore(userId: string, name: string, businessType: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const [newStore] = await db
    .insert(stores)
    .values({
      userId,
      name,
      slug,
      email: '',
      phone: '',
      address: '',
      ninea: '',
      settings: {},
    })
    .returning();
  return newStore;
}

export async function dbSaveProduct(product: Partial<Product>, storeId: string) {
  const dataToSave: any = {
    storeId,
    name: product.name || '',
    price: product.price?.toString() || '0',
    originalPrice: product.originalPrice?.toString(),
    image: product.image,
    stock: product.stock ?? 0,
    mainCategory: product.mainCategory,
    description: product.description,
    businessType: product.businessType || 'shopping',
    options: product.options || [],
    variants: product.variants || [],
  };

  if (product.isOnline !== undefined) {
    dataToSave.isOnline = product.isOnline;
  }

  if (product.id && !product.id.startsWith('temp-')) {
    const [updated] = await db
      .update(products)
      .set(dataToSave)
      .where(eq(products.id, product.id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(products)
      .values(dataToSave)
      .returning();
    return inserted;
  }
}

export async function dbDeleteProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
}

export async function dbSaveCustomer(customer: Partial<Customer>, storeId: string) {
  const dataToSave = {
    storeId,
    name: customer.name || '',
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    totalSpent: customer.totalSpent?.toString() || '0',
    ordersCount: customer.ordersCount ?? 0,
  };

  if (customer.id && !customer.id.startsWith('temp-')) {
    const [updated] = await db
      .update(customers)
      .set(dataToSave)
      .where(eq(customers.id, customer.id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(customers)
      .values(dataToSave)
      .returning();
    return inserted;
  }
}

export async function dbDeleteCustomer(id: string) {
  await db.delete(customers).where(eq(customers.id, id));
}
