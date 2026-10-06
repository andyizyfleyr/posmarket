import { pgTable, uuid, text, timestamp, numeric, integer, boolean, jsonb, AnyPgColumn, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  companyName: text('company_name'),
  ninea: text('ninea'),
  avatarUrl: text('avatar_url'),
  isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
  accountType: text('account_type').default('buyer'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  subscriptionTier: text('subscription_tier'),
  subscriptionDuration: text('subscription_duration'),
  subscriptionStatus: text('subscription_status'),
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => [{
  pk: { columns: [t.identifier, t.token], name: 'verification_tokens_pk' } as const,
}]);

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
}, (t) => [{
  providerIdx: { columns: [t.provider, t.providerAccountId], name: 'accounts_provider_provider_account_id_idx', unique: true } as const,
}]);

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

/**
 * Taxonomie produit globale, geree depuis /pam/categories.
 * `products.mainCategory` (texte) porte le nom d'une categorie parente et
 * `products.category` (texte) le nom d'une sous-categorie : le nom reste la
 * clef de rattachement pour rester compatible avec les produits existants.
 */
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  parentId: uuid('parent_id').references((): AnyPgColumn => productCategories.id, { onDelete: 'set null' }),
  businessType: text('business_type').default('shopping').notNull(), // 'shopping' or 'food'
  position: integer('position').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  { parentIdx: { columns: [t.parentId], name: 'product_categories_parent_id_idx' } as const },
  { positionIdx: { columns: [t.position], name: 'product_categories_position_idx' } as const },
]);

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
  images: jsonb('images').default([]),
  unit: text('unit'),
  deliveryTime: text('delivery_time'),
  preparationTime: text('preparation_time'),
  isOnline: boolean('is_online').default(true).notNull(),
  views: integer('views').default(0).notNull(),
  wholesalePrice: numeric('wholesale_price', { precision: 12, scale: 2 }),
  wholesaleMinQty: integer('wholesale_min_qty'),
  wholesaleTiers: jsonb('wholesale_tiers').default([]),
  mainCategory: text('main_category'),
  businessType: text('business_type').default('shopping').notNull(), // 'shopping' or 'food'
  options: jsonb('options').default([]),
  variants: jsonb('variants').default([]),
  searchVector: text('search_vector').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** Stockage relationnel des variantes (V2).
 *
 * `products.variants` (JSONB) reste la source de lecture pour le storefront,
 * mais chaque enregistrement produit synchronise ici une ligne par combinaison :
 * index SQL, contraintes et reporting sans devoir fouiller dans le JSON.
 */
export const productVariants = pgTable('product_variants', {
  // `id` = id de la variante telle que stockée dans `products.variants` (JSONB) :
  // c'est ce que porte `order_items.variant_id`. `text` et non `uuid` :
  // `newVariantId()` bascule sur un id non-uuid sans `crypto.randomUUID()`.
  // PK composite : deux produits peuvent porter le même id de variante.
  id: text('id').notNull(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name'),
  optionValues: jsonb('option_values').default({}),
  price: numeric('price', { precision: 12, scale: 2 }).default('0'),
  stock: integer('stock').default(0).notNull(),
  sku: text('sku'),
  image: text('image'),
  enabled: boolean('enabled').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [{
  pvPk: { columns: [t.productId, t.id], name: 'product_variants_pk' } as const,
}]);

/** Historique gelé de la matrice à chaque changement (V2).
 *
 * Permet de confronter une ancienne commande à la version de la matrice qui
 * existait au moment de la vente, sans dépendre du JSON vivant de `products`.
 */
export const productVariantSnapshots = pgTable('product_variant_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  options: jsonb('options').default([]),
  variants: jsonb('variants').default([]),
  reason: text('reason'),
  createdBy: text('created_by').default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [{
  pvsProductIdx: { columns: [t.productId], name: 'product_variant_snapshots_product_id_idx' } as const,
}]);

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
  // Vrai = commande fabriquée par le panneau admin « Booster les statistiques » :
  // son stock n'a jamais été décrémenté, annulation/suppression ne doit donc
  // rien réintégrer (voir `updateOrderStatusAction` / `deleteOrderAction`).
  boosted: boolean('boosted').default(false).notNull(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  // Instantané de la ligne au moment de la commande : `products.variants` est un
  // JSONB living, on fige donc l'identité de la variante achetée.
  variantId: text('variant_id'),
  variantLabel: text('variant_label'),
  variantSku: text('variant_sku'),
  variantOptionValues: jsonb('variant_option_values').default({}),
  productName: text('product_name'),
  productUnit: text('product_unit'),
  productImage: text('product_image'),
}, (t) => [
  { variantIdx: { columns: [t.variantId], name: 'order_items_variant_id_idx' } as const },
  { productIdx: { columns: [t.productId], name: 'order_items_product_id_idx' } as const },
]);

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

/**
 * Clés d'idempotence des soumissions de commande.
 *
 * Le client génère une clé par tentative de paiement et la transmet à
 * l'action serveur, qui la réserve avant de créer les commandes : un rejeu
 * (double clic, retry réseau) retrouve les références existantes au lieu de
 * dupliquer la commande.
 */
export const checkoutIdempotency = pgTable('checkout_idempotency', {
  key: text('key').primaryKey(),
  /** NULL tant que la tentative est en cours. */
  orderIds: jsonb('order_ids'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  // Photo de l'auteur (avis générés par le boost, ou profil plus tard).
  authorAvatar: text('author_avatar'),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // Vrai = avis fabriqué par le panneau admin « Booster les statistiques ».
  boosted: boolean('boosted').default(false).notNull(),
});

/**
 * Pool d'auteurs fictifs (nom + photo) injecté par
 * `scripts/seed-review-authors.mjs` et consommé par `boostStoreReviewsAction`.
 * `id` reprend l'`id` du JSON source pour rendre le seed rejouable.
 */
export const reviewAuthors = pgTable('review_authors', {
  id: integer('id').primaryKey(),
  fullName: text('full_name').notNull(),
  gender: text('gender'),
  avatarUrl: text('avatar_url').notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionPayments = pgTable('subscription_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  tier: text('tier').notNull(),
  duration: text('duration').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').default('XOF').notNull(),
  transactionId: text('transaction_id').unique(),
  reference: text('reference'),
  status: text('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull().default(''),
  email: text('email'),
  eventType: text('event_type').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  channel: text('channel').default('whatsapp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationOutbox = pgTable('notification_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientUserId: uuid('recipient_user_id').references(() => profiles.id, { onDelete: 'set null' }),
  recipientPhone: text('recipient_phone').notNull(),
  recipientEmail: text('recipient_email'),
  eventType: text('event_type').notNull(),
  title: text('title'),
  body: text('body').notNull(),
  provider: text('provider').default('whatsapp').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING | SENT | FAILED | SKIPPED | SCHEDULED
  messageId: text('message_id'),
  templateName: text('template_name'),
  params: jsonb('params').default({}),
  attempts: integer('attempts').default(0).notNull(),
  error: text('error'),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  parent: one(productCategories, {
    fields: [productCategories.parentId],
    references: [productCategories.id],
    relationName: 'productCategoryChildren',
  }),
  children: many(productCategories, { relationName: 'productCategoryChildren' }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, { fields: [customers.storeId], references: [stores.id] }),
  orders: many(orders),
}));

export const buyerAddressesRelations = relations(buyerAddresses, ({ one }) => ({
  user: one(profiles, { fields: [buyerAddresses.userId], references: [profiles.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(profiles, { fields: [notificationPreferences.userId], references: [profiles.id] }),
}));

export const notificationOutboxRelations = relations(notificationOutbox, ({ one }) => ({
  recipient: one(profiles, { fields: [notificationOutbox.recipientUserId], references: [profiles.id] }),
}));
