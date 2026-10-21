import { z } from 'zod';

/**
 * Schémas Zod de l'API mobile (PosMarket).
 *
 * Une source de vérité pour la forme des requêtes : chaque route valide son
 * entrée avant d'appeler une action, et répond 400 avec le détail des
 * écarts au lieu de laisser remonter une `undefined` en base.
 */

/* ── Primitives ───────────────────────────────────────────────────────── */

export const uuidSchema = z.uuid('Identifiant invalide.');
export const emailSchema = z.email('Adresse e-mail invalide.');
export const idListSchema = z.array(z.string().trim().min(1)).min(1, 'Liste vide.');
export const freeObject = z.record(z.string(), z.unknown());
/** Charge utile libre (JSON de l'app) : validée par l'action métier. */
export const payload = z.unknown();

/* ── Connexion (acheteur et vendeur partagent le même schéma) ─────────── */

export const authLoginSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  mode: z.enum(['login', 'register']).default('login'),
});

/* ── Espace acheteur ──────────────────────────────────────────────────── */

export const buyerProfileSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  avatarUrl: z.string().trim().max(3_000_000).nullish(),
});

/** Entrée de `updateBuyerProfileAction` (server action, appelée par le web). */
export const buyerProfileUpdateSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  companyName: z.string().trim().max(160).optional(),
  ninea: z.string().trim().max(40).optional(),
  avatarUrl: z.string().trim().max(3_000_000).nullish(),
});

/** Entrée de `saveProductReviewAction`. */
export const reviewPayloadSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(''),
  author: z.string().trim().max(120).optional(),
  authorName: z.string().trim().max(120).optional(),
});

export const buyerAddressSchema = z.object({
  id: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1, 'Libellé requis.').max(120),
  fullName: z.string().trim().min(1, 'Nom complet requis.').max(120),
  phone: z.string().trim().min(1, 'Téléphone requis.').max(40),
  address: z.string().trim().min(1, 'Adresse requise.').max(300),
  city: z.string().trim().min(1, 'Ville requise.').max(120),
  isDefault: z.boolean().default(false),
  userId: z.string().trim().max(64).optional(),
  email: z.string().trim().max(200).optional(),
});

export const buyerAddressDeleteQuerySchema = z.object({
  id: z.string().trim().min(1, 'ID manquant.').max(64),
  userId: z.string().trim().max(64).optional(),
  email: z.string().trim().max(200).optional(),
});

export const buyerReviewSchema = z.object({
  storeId: z.string().trim().min(1, 'Boutique manquante.').max(64),
  productId: z.string().trim().min(1, 'Produit manquant.').max(64),
  rating: z.coerce.number().int().min(1, 'Note invalide.').max(5, 'Note invalide.'),
  comment: z.string().trim().max(2000).default(''),
  author: z.string().trim().max(120).default(''),
});

export const buyerNotificationSchema = z.object({
  eventType: z.string().trim().min(1, 'Événement manquant.').max(64),
  channel: z.enum(['email', 'whatsapp']),
  enabled: z.boolean(),
  whatsappPhone: z.string().trim().max(40).optional(),
  emailAddress: z.string().trim().max(200).optional(),
});

export const buyerOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  email: z.string().trim().max(200).optional(),
  userId: z.string().trim().max(64).optional(),
});

/* ── Checkout ─────────────────────────────────────────────────────────── */

const moneySchema = z.union([z.number(), z.string()]);

const checkoutItemSchema = z.object({
  product: z
    .object({
      id: z.string().trim().max(64).optional(),
      price: moneySchema.optional(),
    })
    .nullish(),
  price: moneySchema.optional(),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  variantId: z.string().trim().max(64).nullish(),
  variantLabel: z.string().trim().max(160).nullish(),
  variantSku: z.string().trim().max(64).nullish(),
  selectedOptions: z.record(z.string(), z.string()).nullish(),
});

const checkoutStoreOrderSchema = z.object({
  items: z.array(checkoutItemSchema).max(100).optional(),
  subtotal: moneySchema.optional(),
  discountAmount: moneySchema.optional(),
  shippingCost: moneySchema.optional(),
  total: moneySchema.optional(),
  promoCode: z.string().trim().max(60).nullish(),
  paymentMethod: z.string().trim().max(40).optional(),
});

const checkoutCustomerSchema = z.object({
  name: z.string().trim().max(160).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  zip: z.string().trim().max(20).optional(),
});

export const checkoutSchema = z.object({
  orders: z.record(z.string(), freeObject),
  customer: freeObject.optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

/** Entrée de `submitCheckoutAction` (action serveur, appelée par le web). */
export const checkoutActionSchema = z.object({
  order: z.record(z.string(), checkoutStoreOrderSchema),
  customer: checkoutCustomerSchema.optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

/* ── Espace vendeur ───────────────────────────────────────────────────── */

export const sellerStoreIdSchema = z.object({
  storeId: z.string().trim().min(1, 'Boutique manquante.').max(64),
});

export const sellerIdsSchema = z.object({
  ids: idListSchema,
  storeId: z.string().trim().max(64).optional(),
});

export const sellerIdSchema = z.object({
  id: z.string().trim().min(1, 'Identifiant manquant.').max(64),
  storeId: z.string().trim().max(64).optional(),
});

/** Export : la liste de produits est facultative (export complet). */
export const sellerExportSchema = z.object({
  ids: z.array(z.string().trim().min(1)).optional(),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerOrderStatusSchema = z.object({
  orderId: z.string().trim().min(1, 'Commande manquante.').max(64),
  status: z.string().trim().min(1, 'Statut manquant.').max(40),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerBulkOrderStatusSchema = z.object({
  orderIds: idListSchema,
  status: z.string().trim().min(1, 'Statut manquant.').max(40),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerInvoiceStatusSchema = z.object({
  invoiceId: z.string().trim().min(1, 'Facture manquante.').max(64),
  status: z.string().trim().min(1, 'Statut manquant.').max(40),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerInvoiceSaveSchema = z.object({
  invoice: freeObject,
  storeId: z.string().trim().max(64).optional(),
});

export const sellerCustomerSaveSchema = z.object({
  id: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1, 'Nom requis.').max(160),
  email: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(300).nullish(),
  totalSpent: z.coerce.number().min(0).optional(),
  ordersCount: z.coerce.number().int().min(0).optional(),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerCustomerDeleteSchema = z.object({
  id: z.string().trim().min(1, 'Client manquant.').max(64),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerInventorySaveSchema = z.object({
  product: freeObject,
  storeId: z.string().trim().max(64).optional(),
});

export const sellerInventoryImportSchema = z.object({
  items: z.array(freeObject).default([]),
  options: freeObject.optional(),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerInventoryTransferSchema = z.object({
  sourceStoreId: z.string().trim().min(1, 'Boutique source manquante.').max(64),
  targetStoreId: z.string().trim().min(1, 'Boutique cible manquante.').max(64),
  productIds: z.array(z.string().trim().min(1)).default([]),
  options: freeObject.optional(),
});

export const sellerPosCheckoutSchema = z.object({
  storeId: z.string().trim().min(1, 'Boutique manquante.').max(64),
  order: freeObject,
});

export const sellerSettingsProfileSchema = z.object({
  fullName: z.string().trim().max(120).default(''),
  avatarUrl: z.string().trim().max(3_000_000).optional(),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerSettingsUpdateSchema = z.object({
  settings: freeObject.optional(),
  storeId: z.string().trim().max(64).optional(),
});

export const sellerStaffSchema = z.object({
  action: z.enum(['add', 'delete']).default('add'),
  storeId: z.string().trim().max(64).optional(),
  staff: z
    .object({
      email: z.string().trim().max(200).optional(),
      role: z.string().trim().max(40).optional(),
    })
    .optional(),
  id: z.string().trim().max(64).optional(),
});

export const sellerCouponsSchema = z.object({
  action: z.enum(['save', 'delete', 'toggle']).default('save'),
  storeId: z.string().trim().max(64).optional(),
  coupon: freeObject.optional(),
  id: z.string().trim().max(64).optional(),
  active: z.boolean().optional(),
});

/* ── Lecture (query strings) ──────────────────────────────────────────── */

/** Boutique courante, passée en query string par l'app. */
export const storeIdQuerySchema = z.object({
  storeId: z.string().trim().max(64).optional(),
});

/** Pagination + recherche (listes vendeur). */
export const listQuerySchema = z.object({
  storeId: z.string().trim().max(64).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(10),
  search: z.string().trim().max(200).default(''),
  filterStatus: z.string().trim().max(40).default('all'),
});

export const couponsQuerySchema = z.object({
  storeIds: z.string().trim().max(4000).default(''),
});

export const invoiceItemsQuerySchema = z.object({
  invoiceId: z.string().trim().min(1, 'Facture manquante.').max(64),
});

export const orderItemsQuerySchema = z.object({
  orderId: z.string().trim().min(1, 'Commande manquante.').max(64),
});

export const inventoryQuerySchema = z.object({
  categories: z.string().trim().max(10).optional(),
  businessType: z.string().trim().max(20).default('all'),
  storeId: z.string().trim().max(64).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(10),
  search: z.string().trim().max(200).default(''),
  productType: z.string().trim().max(20).default('all'),
});

export const bootstrapQuerySchema = z.object({
  storeId: z.string().trim().max(64).optional(),
});

/* ── Actions boutique / abonnement ────────────────────────────────────── */

export const sellerStoreActionSchema = z.object({
  action: z.enum(['create', 'delete', 'settings']).default('create'),
  name: z.string().trim().max(160).optional(),
  businessType: z.enum(['shopping', 'food']).optional(),
  storeId: z.string().trim().max(64).optional(),
  settings: freeObject.optional(),
});

export const subscriptionActionSchema = z.object({
  action: z.enum(['create', 'update', 'confirm']).default('create'),
  tier: z.string().trim().max(40).optional(),
  duration: z.string().trim().max(40).optional(),
  transactionId: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(160).optional(),
});

/* ── Server actions (web) ────────────────────────────────────────────── */

export const couponInputSchema = z.object({
  code: z.string().trim().min(1, 'Code promo manquant.').max(60),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().trim().max(40).nullish(),
});

export const staffInputSchema = z.object({
  email: z.string().trim().min(1, 'Email manquant.').max(200),
  role: z.string().trim().max(40).optional(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().max(120).default(''),
  email: z.string().trim().max(200).optional(),
  avatarUrl: z.string().trim().max(3_000_000).optional(),
});

export const customerInputSchema = z.object({
  id: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1, 'Nom requis.').max(160),
  email: z.string().trim().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(300).nullish(),
  totalSpent: z.coerce.number().min(0).optional(),
  ordersCount: z.coerce.number().int().min(0).optional(),
});

export const invoiceInputSchema = freeObject;

/* ── Webhooks fournisseurs ───────────────────────────────────────────── */

/** Payload Kkiapay (signature vérifiée avant parsing). */
export const kkiapayWebhookSchema = z.object({
  event: z.string().trim().max(60).optional(),
  isPaymentSucces: z.boolean().optional(),
  partnerId: z.string().trim().max(120).optional(),
  transactionId: z.string().trim().max(120).optional(),
  amount: z.coerce.number().optional(),
});

/** Payload WhatsApp Cloud API (signature vérifiée avant parsing). */
export const whatsappWebhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z
                .object({
                  statuses: z
                    .array(
                      z.object({
                        id: z.string().trim().max(120).optional(),
                        status: z.string().trim().max(40).optional(),
                        timestamp: z.string().trim().max(40).optional(),
                      }),
                    )
                    .optional(),
                  messages: z.array(z.unknown()).optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

/* ── Catalogue (lecture) ──────────────────────────────────────────────── */

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const catalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  email: z.string().trim().max(200).optional(),
  userId: z.string().trim().max(64).optional(),
});

export const pathIdSchema = z.object({
  id: z.string().trim().min(1, 'Identifiant manquant.').max(128),
});
