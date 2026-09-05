import { pgTable, uuid, text, timestamp, numeric, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  companyName: text('company_name'),
  ninea: text('ninea'),
  avatarUrl: text('avatar_url'),
  isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
  subscriptionTier: text('subscription_tier').default('PRO'),
  subscriptionDuration: text('subscription_duration').default('monthly'),
  subscriptionStatus: text('subscription_status').default('ACTIVE'),
  subscriptionStartDate: timestamp('subscription_start_date').defaultNow(),
  subscriptionEndDate: timestamp('subscription_end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  ninea: text('ninea'),
  description: text('description'),
  logo: text('logo'),
  theme: text('theme'),
  businessType: text('business_type').default('shopping').notNull(), // 'shopping' or 'food'
  status: text('status').default('APPROVED').notNull(),
  views: integer('views').default(0).notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  category: text('category'),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  originalPrice: numeric('original_price', { precision: 12, scale: 2 }),
  stock: integer('stock').default(0).notNull(),
  image: text('image'),
  isOnline: boolean('is_online').default(true).notNull(),
  views: integer('views').default(0).notNull(),
  wholesalePrice: numeric('wholesale_price', { precision: 12, scale: 2 }),
  wholesaleMinQty: integer('wholesale_min_qty'),
  wholesaleTiers: jsonb('wholesale_tiers').default([]),
  mainCategory: text('main_category'),
  businessType: text('business_type').default('shopping').notNull(), // 'shopping' or 'food'
  options: jsonb('options').default([]),
  variants: jsonb('variants').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).default('0').notNull(),
  ordersCount: integer('orders_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const buyerAddresses = pgTable('buyer_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  buyerUserId: uuid('buyer_user_id').references(() => profiles.id, { onDelete: 'set null' }),
  buyerEmail: text('buyer_email'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0'),
  promoCode: text('promo_code'),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').default('PENDING').notNull(),
  type: text('type').default('IN_STORE').notNull(),
  date: timestamp('date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  invoiceNumber: text('invoice_number').notNull(),
  customerName: text('customer_name'),
  customerEmail: text('customer_email'),
  customerAddress: text('customer_address'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  status: text('status').default('DRAFT').notNull(),
  notes: text('notes'),
  date: timestamp('date').defaultNow(),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  description: text('description'),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
});

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  code: text('code').notNull(),
  discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).default('0').notNull(),
  active: boolean('active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  authorName: text('author_name').default('Anonyme').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  isRoot: boolean('is_root').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storeStaff = pgTable('store_staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('SELLER').notNull(),
  permissions: jsonb('permissions').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storeStats = pgTable('store_stats', {
  storeId: uuid('store_id').primaryKey().references(() => stores.id, { onDelete: 'cascade' }),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }).default('0').notNull(),
  totalReviews: integer('total_reviews').default(0).notNull(),
});

export const productStats = pgTable('product_stats', {
  productId: uuid('product_id').primaryKey().references(() => products.id, { onDelete: 'cascade' }),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  totalSales: integer('total_sales').default(0).notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }).default('0').notNull(),
});

// Relations
export const storesRelations = relations(stores, ({ one, many }) => ({
  owner: one(profiles, { fields: [stores.userId], references: [profiles.id] }),
  products: many(products),
  categories: many(categories),
  customers: many(customers),
  orders: many(orders),
  invoices: many(invoices),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderItems: many(orderItems),
  stats: one(productStats, { fields: [products.id], references: [productStats.productId] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
  invoices: many(invoices),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  store: one(stores, { fields: [invoices.storeId], references: [stores.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const couponsRelations = relations(coupons, ({ one }) => ({
  store: one(stores, { fields: [coupons.storeId], references: [stores.id] }),
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  store: one(stores, { fields: [productReviews.storeId], references: [stores.id] }),
  product: one(products, { fields: [productReviews.productId], references: [products.id] }),
}));

export const storeStaffRelations = relations(storeStaff, ({ one }) => ({
  store: one(stores, { fields: [storeStaff.storeId], references: [stores.id] }),
  user: one(profiles, { fields: [storeStaff.userId], references: [profiles.id] }),
}));

export const storeStatsRelations = relations(storeStats, ({ one }) => ({
  store: one(stores, { fields: [storeStats.storeId], references: [stores.id] }),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  stores: many(stores),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  store: one(stores, { fields: [categories.storeId], references: [stores.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, { fields: [customers.storeId], references: [stores.id] }),
  orders: many(orders),
}));

export const buyerAddressesRelations = relations(buyerAddresses, ({ one }) => ({
  user: one(profiles, { fields: [buyerAddresses.userId], references: [profiles.id] }),
}));
