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

export async function dbFetchStoreData(storeId: string, ownerId?: string) {
  const [
    storeRes,
    productsRes,
    ordersRes,
    customersRes,
    invoicesRes,
    statsRes,
    profileRes
  ] = await Promise.all([
    db.select().from(stores).where(eq(stores.id, storeId)).limit(1),
    db.select().from(products).where(eq(products.storeId, storeId)).limit(200),
    db.select().from(orders).where(eq(orders.storeId, storeId)).orderBy(desc(orders.date)).limit(100),
    db.select().from(customers).where(eq(customers.storeId, storeId)).orderBy(desc(customers.createdAt)).limit(100),
    db.select().from(invoices).where(eq(invoices.storeId, storeId)).limit(100).catch(() => []),
    db.select().from(productStats).where(eq(productStats.storeId, storeId)).catch(() => []),
    ownerId ? db.select().from(profiles).where(eq(profiles.id, ownerId)).limit(1) : Promise.resolve([])
  ]);

  const store = storeRes[0] || null;
  let profile = profileRes[0] || null;

  if (!profile && store?.userId) {
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

  // Join order items + products and customers for orders
  const customersMap = Object.fromEntries((customersRes || []).map((c: any) => [c.id, c]));
  const orderIds = (ordersRes || []).map((o: any) => o.id);

  let itemsByOrder: Record<string, any[]> = {};
  if (orderIds.length > 0) {
    const itemsRes = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const productIds = [...new Set(itemsRes.map((i: any) => i.productId).filter(Boolean))];
    let productsMap: Record<string, any> = {};
    if (productIds.length > 0) {
      const prodRes = await db
        .select()
        .from(products)
        .where(inArray(products.id, productIds));
      productsMap = Object.fromEntries(prodRes.map((p: any) => [p.id, p]));
    }

    itemsByOrder = (itemsRes || []).reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push({
        product: item.productId ? productsMap[item.productId] || null : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      });
      return acc;
    }, {});
  }

  const formattedOrders = (ordersRes || []).map((o: any) => {
    const customer = o.customerId ? customersMap[o.customerId] : undefined;
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
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
            totalSpent: customer.totalSpent,
            ordersCount: customer.ordersCount,
          }
        : undefined,
      items: itemsByOrder[o.id] || [],
    };
  });

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
