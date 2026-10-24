'use server'

import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import {
  stores,
  products,
  productStats,
  orders,
  orderItems,
  customers,
  coupons,
  checkoutIdempotency,
} from '@/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { getCurrentSession } from '@/app/actions/session'
import { notify, getStorePhone } from '@/lib/notifications'
import { orderEmailProducts } from '@/lib/email'
import { detectClientCountry, isCountryAllowed, getSupportedCountriesLabel } from '@/lib/geo'
import { generateProductSlug } from '@/utils/slug'
import { getEffectiveWholesaleUnitPrice } from '@/utils/wholesale'
import { getClientIp, rateLimit, rateLimitMessage } from '@/lib/rate-limit'
import { checkoutActionSchema } from '@/lib/schemas'
import type { Product, ProductOption, WholesaleTier } from '@/types'

type CheckoutItemInput = {
  product?: { id?: string; price?: number | string } | null
  /** Prix indicatif du navigateur : jamais utilisé pour la facturation. */
  price?: number | string
  quantity?: number
  variantId?: string | null
  variantLabel?: string | null
  variantSku?: string | null
  selectedOptions?: Record<string, string> | null
}

type CheckoutStoreOrder = {
  items?: CheckoutItemInput[]
  subtotal?: number | string
  discountAmount?: number | string
  shippingCost?: number | string
  total?: number | string
  promoCode?: string | null
  paymentMethod?: string
}

type CheckoutCustomer = {
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  zip?: string
}

type PricedLine = {
  productId: string
  storeId: string
  quantity: number
  unitPrice: number
  expectedPrice: number
  expectedStock: number
  variantId: string | null
  variantLabel: string | null
  variantSku: string | null
  variantOptionValues: Record<string, string>
  productName: string
  productUnit: string | null
  productImage: string | null
  productOptions: ProductOption[]
  wholesaleApplied: boolean
  wholesaleTiers: WholesaleTier[]
  wholesalePrice: number | null
  wholesaleMinQty: number | null
}

type StoreCheckout = {
  storeId: string
  storeName: string
  storeBusinessType: string
  orderId: string
  items: PricedLine[]
  subtotal: number
  discount: number
  shipping: number
  total: number
  promoCode: string | null
  paymentMethod: 'ESPECES'
  customerCreated: boolean
}

type CheckoutOrderResponse = {
  id: string
  storeId: string
  storeName: string
  subtotal: number
  discount: number
  shipping: number
  total: number
  paymentMethod: string
  status: string
  items: Array<{
    id: string
    productId: string | null
    name: string
    image: string | null
    quantity: number
    unitPrice: number
    total: number
    variantId: string | null
    variantLabel: string | null
    variantOptionValues: Record<string, string>
  }>
}

class CheckoutValidationError extends Error {}

const MAX_STORES = 10
const MAX_ITEMS = 100
const MAX_QUANTITY = 999
const ALLOWED_PAYMENT_METHODS = new Set(['ESPECES'])

const roundMoney = (value: number): number =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100

const reject = (message: string): never => {
  throw new CheckoutValidationError(message)
}

const toText = (value: unknown, max: number): string =>
  String(value ?? '').trim().slice(0, max)

const toOptions = (raw: unknown): ProductOption[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((option): option is ProductOption => {
      return Boolean(
        option &&
          typeof option === 'object' &&
          typeof (option as ProductOption).id === 'string' &&
          typeof (option as ProductOption).name === 'string' &&
          Array.isArray((option as ProductOption).values),
      )
    })
    .map((option) => ({
      id: String(option.id),
      name: String(option.name),
      values: option.values.map(String).filter(Boolean),
    }))
}

const toWholesaleTiers = (raw: unknown): WholesaleTier[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((tier): tier is WholesaleTier => Boolean(tier && typeof tier === 'object'))
    .map((tier) => {
      const unitPrice = Number((tier as WholesaleTier).unitPrice)
      return {
        minQty: Math.max(1, Math.floor(Number((tier as WholesaleTier).minQty) || 1)),
        price: Math.max(0, Number((tier as WholesaleTier).price) || 0),
        ...(Number.isFinite(unitPrice) && unitPrice > 0 ? { unitPrice } : {}),
      }
    })
    .filter((tier) => Number.isFinite(tier.price) && tier.price > 0)
}

const loadCheckoutOrders = async (orderIds: string[]): Promise<CheckoutOrderResponse[]> => {
  if (orderIds.length === 0) return []

  const rows = await db
    .select({
      id: orders.id,
      storeId: orders.storeId,
      storeName: stores.name,
      subtotal: orders.subtotal,
      discount: orders.discountAmount,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
    })
    .from(orders)
    .innerJoin(stores, eq(orders.storeId, stores.id))
    .where(inArray(orders.id, orderIds))

  const items = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      name: orderItems.productName,
      image: orderItems.productImage,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      variantId: orderItems.variantId,
      variantLabel: orderItems.variantLabel,
      variantOptionValues: orderItems.variantOptionValues,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))

  const itemsByOrder = new Map<string, CheckoutOrderResponse['items']>()
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) || []
    list.push({
      id: item.id,
      productId: item.productId,
      name: String(item.name || 'Article'),
      image: item.image || null,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      total: Number(item.total) || 0,
      variantId: item.variantId || null,
      variantLabel: item.variantLabel || null,
      variantOptionValues:
        item.variantOptionValues && typeof item.variantOptionValues === 'object'
          ? (item.variantOptionValues as Record<string, string>)
          : {},
    })
    itemsByOrder.set(item.orderId, list)
  }

  const orderMap = new Map(rows.map((row) => [row.id, row]))
  return orderIds
    .map((id) => orderMap.get(id))
    .filter((row): row is (typeof rows)[number] => Boolean(row))
    .map((row) => ({
      id: row.id,
      storeId: row.storeId,
      storeName: row.storeName,
      subtotal: Number(row.subtotal) || 0,
      discount: Number(row.discount) || 0,
      shipping: 0,
      total: Number(row.total) || 0,
      paymentMethod: row.paymentMethod,
      status: row.status,
      items: itemsByOrder.get(row.id) || [],
    }))
}

export async function submitCheckoutAction(
  order: Record<string, CheckoutStoreOrder> = {},
  customerData?: CheckoutCustomer,
  idempotencyKey?: string,
) {
  // Validation Zod de l'entrée : le web comme le mobile passent par ici, on ne
  // fait donc confiance à aucun champ pour continuer le traitement.
  const parsed = checkoutActionSchema.safeParse({
    order: order ?? {},
    customer: customerData ?? undefined,
    idempotencyKey: idempotencyKey ?? undefined,
  })
  if (!parsed.success) {
    return {
      success: false as const,
      error: 'Données de commande invalides.',
    }
  }
  const validatedOrder = parsed.data.order as Record<string, CheckoutStoreOrder>
  const validatedCustomer = parsed.data.customer as CheckoutCustomer | undefined
  const validatedKey = parsed.data.idempotencyKey

  const ip = await getClientIp()
  const limit = rateLimit(`checkout:${ip}`, 12, 60_000)
  if (!limit.ok) {
    return { success: false as const, error: rateLimitMessage(limit.retryAfterSeconds) }
  }

  // Pays du client (IP) — blocage autoritaire : on ne crée aucune commande si
  // le pays détecté n'est pas desservi. Non bypassable côté navigateur.
  const countryGate = await detectClientCountry()
  if (countryGate.detected && countryGate.code && !isCountryAllowed(countryGate.code)) {
    return {
      success: false as const,
      error: `Commande impossible : nous livrons actuellement uniquement au ${getSupportedCountriesLabel()}. Votre connexion indique un autre pays.`,
    }
  }

  const rawKey = typeof validatedKey === 'string' ? validatedKey.trim() : ''
  if (rawKey.length > 128) {
    return { success: false as const, error: 'Clé de commande invalide. Rechargez la page et réessayez.' }
  }
  const key = rawKey || null
  let ownsKey = false
  let completed = false

  const { user } = await getCurrentSession()
  const customer = validatedCustomer || {}

  try {
    if (key) {
      // Purge les réservations orphelines (crash, coupure réseau) : une clé
      // bloquée ne doit pas empêcher un client de commander indéfiniment.
      await db
        .execute(
          sql`DELETE FROM checkout_idempotency
              WHERE (order_ids IS NULL AND created_at < NOW() - INTERVAL '15 minutes')
                 OR created_at < NOW() - INTERVAL '7 days'`,
        )
        .catch(() => undefined)

      const [reserved] = await db
        .insert(checkoutIdempotency)
        .values({ key, orderIds: null })
        .onConflictDoNothing()
        .returning({ key: checkoutIdempotency.key })

      if (!reserved) {
        const [existing] = await db
          .select()
          .from(checkoutIdempotency)
          .where(eq(checkoutIdempotency.key, key))
          .limit(1)

        if (existing?.orderIds) {
          const replayed = (existing.orderIds as string[]).filter(Boolean)
          return {
            success: true as const,
            orderId: replayed[0],
            orderIds: replayed,
            orders: await loadCheckoutOrders(replayed),
            error: undefined,
          }
        }
        return {
          success: false as const,
          error: 'Cette commande est déjà en cours de traitement. Merci de ne pas confirmer deux fois.',
        }
      }
      ownsKey = true
    }

    const ordersData =
      validatedOrder && typeof validatedOrder === 'object' && !Array.isArray(validatedOrder)
        ? validatedOrder
        : {}
    const storeEntries = Object.entries(ordersData).filter(([, value]) => Boolean(value))
    if (storeEntries.length === 0) {
      reject('Votre panier est vide.')
    }
    if (storeEntries.length > MAX_STORES) {
      reject(`Une commande ne peut pas contenir plus de ${MAX_STORES} boutiques.`)
    }

    let totalItemCount = 0
    for (const [storeId, storeOrder] of storeEntries) {
      if (!storeId || typeof storeId !== 'string') reject('Boutique invalide.')
      const items = Array.isArray(storeOrder.items) ? storeOrder.items : []
      if (items.length === 0) continue
      totalItemCount += items.length
      const paymentMethod = String(storeOrder.paymentMethod || 'ESPECES').toUpperCase()
      if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
        reject('Mode de paiement non disponible. Le paiement à la livraison est requis.')
      }
    }
    if (totalItemCount === 0) reject('Votre panier est vide.')
    if (totalItemCount > MAX_ITEMS) {
      reject(`Une commande ne peut pas contenir plus de ${MAX_ITEMS} articles.`)
    }

    const storeIds = storeEntries.map(([storeId]) => storeId)
    const storeRows = await db
      .select({
        id: stores.id,
        name: stores.name,
        businessType: stores.businessType,
        status: stores.status,
        settings: stores.settings,
      })
      .from(stores)
      .where(inArray(stores.id, storeIds))
    const storeMap = new Map(storeRows.map((row) => [row.id, row]))

    for (const storeId of storeIds) {
      const store = storeMap.get(storeId)
      if (!store) throw new CheckoutValidationError('Une boutique de votre panier n’existe plus.')
      if (store.status !== 'APPROVED') {
        throw new CheckoutValidationError(
          `La boutique « ${store.name} » n’accepte pas encore les commandes.`,
        )
      }
    }

    const allProductIds = Array.from(
      new Set(
        storeEntries.flatMap(([, storeOrder]) =>
          (Array.isArray(storeOrder.items) ? storeOrder.items : [])
            .map((item) => String(item?.product?.id || ''))
            .filter(Boolean),
        ),
      ),
    )
    if (allProductIds.length === 0) reject('Aucun article valide dans votre panier.')
    if (allProductIds.length > MAX_ITEMS) reject('Trop d’articles dans votre panier.')

    const productRows = await db
      .select({
        id: products.id,
        storeId: products.storeId,
        name: products.name,
        unit: products.unit,
        image: products.image,
        price: products.price,
        stock: products.stock,
        isOnline: products.isOnline,
        businessType: products.businessType,
        options: products.options,
        variants: products.variants,
        wholesalePrice: products.wholesalePrice,
        wholesaleMinQty: products.wholesaleMinQty,
        wholesaleTiers: products.wholesaleTiers,
      })
      .from(products)
      .where(inArray(products.id, allProductIds))
    const catalog = new Map(productRows.map((row) => [row.id, row]))

    const customerName = toText(
      customer.name || user?.email?.split('@')[0] || 'Client',
      120,
    ) || 'Client'
    const phone = String(customer.phone || '').replace(/\D/g, '').slice(0, 20)
    if (phone && (phone.length < 6 || phone.length > 20)) {
      reject('Le numéro de téléphone est invalide.')
    }
    const email = toText(customer.email || user?.email || '', 190)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reject('L’adresse e-mail est invalide.')
    }
    const address = toText(customer.address, 300) || null
    const buyerEmail = email || null

    const storeCheckouts: StoreCheckout[] = []

    for (const [storeId, storeOrder] of storeEntries) {
      const items = Array.isArray(storeOrder.items) ? storeOrder.items : []
      if (items.length === 0) continue

      const store = storeMap.get(storeId)
      if (!store) throw new CheckoutValidationError('Boutique introuvable.')

      const settings =
        store.settings && typeof store.settings === 'object'
          ? (store.settings as Record<string, unknown>)
          : {}
      const wholesaleEnabled = settings.wholesaleEnabled !== false
      const wholesaleMinOrderAmount = Math.max(
        0,
        Number(settings.wholesaleMinOrderAmount) || 0,
      )
      const wholesaleAllowed =
        store.businessType === 'shopping' && wholesaleEnabled

      const pricedItems: PricedLine[] = []
      for (const item of items) {
        const productId = String(item?.product?.id || '')
        const row = catalog.get(productId)
        if (!row) {
          throw new CheckoutValidationError(
            'Un article de votre commande n’existe plus. Actualisez votre panier.',
          )
        }
        if (row.storeId !== storeId) {
          throw new CheckoutValidationError(
            'Un article de votre commande ne provient pas de cette boutique.',
          )
        }
        if (!row.isOnline) {
          reject(`« ${row.name} » n’est plus disponible à la vente.`)
        }
        if (row.businessType !== 'shopping' && row.businessType !== 'food') {
          reject(`La catégorie de « ${row.name} » n’est pas supportée.`)
        }

        const quantity = Math.floor(Number(item?.quantity) || 0)
        if (!Number.isFinite(quantity) || quantity < 1) {
          reject(`Quantité invalide pour « ${row.name} ».`)
        }
        if (quantity > MAX_QUANTITY) {
          reject(`La quantité de « ${row.name} » dépasse la limite autorisée.`)
        }

        const options = toOptions(row.options)
        const variants = Array.isArray(row.variants)
          ? (row.variants as Array<{
              id?: string
              name?: string
              price?: number
              stock?: number
              sku?: string
              optionValues?: Record<string, string>
              enabled?: boolean
            }>)
          : []

        const variantId = item?.variantId ? String(item.variantId) : ''
        const variant = variantId ? variants.find((v) => String(v.id) === variantId) : undefined

        if (variants.length > 0 && options.length === 0) {
          reject(`« ${row.name} » a des variantes mais aucune option configurée. Contactez le vendeur.`)
        }
        if (variants.length > 0 && !variant) {
          reject(`Choisissez les options de « ${row.name} » avant de valider.`)
        }
        if (variant && variant.enabled === false) {
          reject(`La variante choisie pour « ${row.name} » n’est plus disponible.`)
        }

        let basePrice: number
        let expectedStock: number
        let variantLabel: string | null = null
        let variantSku: string | null = null
        let variantOptionValues: Record<string, string> = {}
        let effectiveVariantId: string | null = null

        if (variant) {
          basePrice = Number(variant.price)
          expectedStock = Number(variant.stock)
          effectiveVariantId = String(variant.id)
          variantLabel = variant.name ? String(variant.name) : null
          variantSku = variant.sku ? String(variant.sku) : null
          variantOptionValues =
            variant.optionValues && typeof variant.optionValues === 'object'
              ? variant.optionValues
              : {}
        } else if (options.length > 0) {
          const selected =
            item?.selectedOptions && typeof item.selectedOptions === 'object'
              ? item.selectedOptions
              : {}
          const missing = options.filter((option) => {
            const value = selected[option.id]
            return !value || !option.values.includes(String(value))
          })
          if (missing.length > 0) {
            reject(`Choisissez toutes les options de « ${row.name} » avant de valider.`)
          }
          variantLabel = options.map((option) => String(selected[option.id])).join(' / ')
          variantOptionValues = Object.fromEntries(
            options.map((option) => [option.id, String(selected[option.id])]),
          )
          basePrice = Number(row.price)
          expectedStock = Number(row.stock)
        } else {
          basePrice = Number(row.price)
          expectedStock = Number(row.stock)
        }

        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          reject(`Le prix de « ${row.name} » est invalide.`)
        }
        if (!Number.isFinite(expectedStock) || expectedStock < quantity) {
          const detail = variantLabel ? ` (${variantLabel})` : ''
          reject(
            `Stock insuffisant pour « ${row.name}${detail} » : ${Math.max(
              0,
              Number.isFinite(expectedStock) ? expectedStock : 0,
            )} disponible(s).`,
          )
        }

        const tiers = wholesaleAllowed ? toWholesaleTiers(row.wholesaleTiers) : []
        const legacyWholesalePrice =
          row.wholesalePrice != null ? Number(row.wholesalePrice) : null
        const legacyWholesaleMinQty =
          row.wholesaleMinQty != null ? Number(row.wholesaleMinQty) : null

        const syntheticProduct = {
          price: basePrice,
          wholesalePrice:
            wholesaleAllowed && Number.isFinite(legacyWholesalePrice || NaN)
              ? (legacyWholesalePrice as number)
              : undefined,
          wholesaleMinQty:
            wholesaleAllowed && Number.isFinite(legacyWholesaleMinQty || NaN)
              ? (legacyWholesaleMinQty as number)
              : undefined,
          wholesaleTiers: tiers,
        } as unknown as Product

        const wholesaleUnitPrice = getEffectiveWholesaleUnitPrice(
          syntheticProduct,
          quantity,
          basePrice,
        )
        const unitPrice =
          Number.isFinite(wholesaleUnitPrice) && wholesaleUnitPrice > 0
            ? wholesaleUnitPrice
            : basePrice

        pricedItems.push({
          productId,
          storeId,
          quantity,
          unitPrice,
          expectedPrice: basePrice,
          expectedStock,
          variantId: effectiveVariantId,
          variantLabel,
          variantSku,
          variantOptionValues,
          productName: row.name,
          productUnit: row.unit,
          productImage: row.image,
          productOptions: options,
          wholesaleApplied: unitPrice < basePrice - 0.005,
          wholesaleTiers: tiers,
          wholesalePrice: legacyWholesalePrice,
          wholesaleMinQty: legacyWholesaleMinQty,
        })
      }

      const subtotal = roundMoney(
        pricedItems.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
      )
      const hasWholesaleLine = pricedItems.some((line) => line.wholesaleApplied)
      if (
        hasWholesaleLine &&
        wholesaleMinOrderAmount > 0 &&
        subtotal < wholesaleMinOrderAmount
      ) {
        reject(
          `Le minimum de commande en gros est de ${new Intl.NumberFormat('fr-FR').format(
            wholesaleMinOrderAmount,
          )} FCFA pour « ${store.name} ». Ajoutez des articles ou repassez au prix de détail.`,
        )
      }

      const requestedPromoCode = toText(storeOrder.promoCode, 64)
      let promoLabel: string | null = null
      let discount = 0
      if (requestedPromoCode) {
        const [coupon] = await db
          .select({
            code: coupons.code,
            discountPct: coupons.discountPct,
            active: coupons.active,
            expiresAt: coupons.expiresAt,
          })
          .from(coupons)
          .where(and(eq(coupons.storeId, storeId), eq(coupons.code, requestedPromoCode)))
          .limit(1)
        const usable =
          coupon &&
          coupon.active &&
          (!coupon.expiresAt || new Date(coupon.expiresAt).getTime() > Date.now())
        if (usable && coupon) {
          const pct = Math.max(0, Math.min(Number(coupon.discountPct) || 0, 100))
          discount = roundMoney(Math.min((subtotal * pct) / 100, subtotal))
          promoLabel = coupon.code
        }
      }

      // Les frais de livraison ne sont pas encore configurables par boutique.
      // On ignore donc toute valeur envoyée par le client (0 par défaut).
      const shipping = 0
      const total = roundMoney(Math.max(0, subtotal - discount + shipping))

      const [existingCustomer] = phone
        ? await db
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.storeId, storeId), eq(customers.phone, phone)))
            .limit(1)
        : [undefined]

      storeCheckouts.push({
        storeId,
        storeName: store.name,
        storeBusinessType: store.businessType,
        orderId: randomUUID(),
        items: pricedItems,
        subtotal,
        discount,
        shipping,
        total,
        promoCode: promoLabel,
        paymentMethod: 'ESPECES',
        customerCreated: Boolean(phone) && !existingCustomer,
      })
    }

    if (storeCheckouts.length === 0) reject('Aucune commande n’a pu être enregistrée.')

    // ---------------------------------------------------------------------
    // Écriture atomique : toutes les boutiques, lignes, stocks et compteurs
    // sont envoyés dans une seule transaction Neon. Un stock insuffisant ou un
    // prix modifié entre la lecture et l'écriture fait échouer l'ensemble.
    // ---------------------------------------------------------------------
    const batch: BatchItem<'pg'>[] = []
    const variantOps = new Map<
      string,
      {
        productId: string
        storeId: string
        variantId: string
        quantity: number
        expectedPrice: number
        expectedStock: number
        optionValues: Record<string, string>
        wholesaleApplied: boolean
        wholesaleTiers: WholesaleTier[]
        wholesalePrice: number | null
        wholesaleMinQty: number | null
      }
    >()
    const simpleOps = new Map<
      string,
      {
        productId: string
        storeId: string
        quantity: number
        expectedPrice: number
        expectedStock: number
        options: ProductOption[]
        wholesaleApplied: boolean
        wholesaleTiers: WholesaleTier[]
        wholesalePrice: number | null
        wholesaleMinQty: number | null
      }
    >()

    for (const sc of storeCheckouts) {
      for (const line of sc.items) {
        if (line.variantId) {
          const opKey = `${sc.storeId}:${line.productId}:${line.variantId}`
          const current = variantOps.get(opKey)
          if (current) {
            current.quantity += line.quantity
            current.wholesaleApplied = current.wholesaleApplied || line.wholesaleApplied
          } else {
            variantOps.set(opKey, {
              productId: line.productId,
              storeId: sc.storeId,
              variantId: line.variantId,
              quantity: line.quantity,
              expectedPrice: line.expectedPrice,
              expectedStock: line.expectedStock,
              optionValues: line.variantOptionValues,
              wholesaleApplied: line.wholesaleApplied,
              wholesaleTiers: line.wholesaleTiers,
              wholesalePrice: line.wholesalePrice,
              wholesaleMinQty: line.wholesaleMinQty,
            })
          }
        } else {
          const opKey = `${sc.storeId}:${line.productId}`
          const current = simpleOps.get(opKey)
          if (current) {
            current.quantity += line.quantity
            current.wholesaleApplied = current.wholesaleApplied || line.wholesaleApplied
          } else {
            simpleOps.set(opKey, {
              productId: line.productId,
              storeId: sc.storeId,
              quantity: line.quantity,
              expectedPrice: line.expectedPrice,
              expectedStock: line.expectedStock,
              options: line.productOptions,
              wholesaleApplied: line.wholesaleApplied,
              wholesaleTiers: line.wholesaleTiers,
              wholesalePrice: line.wholesalePrice,
              wholesaleMinQty: line.wholesaleMinQty,
            })
          }
        }
      }
    }

    const variantProductKeys = new Set<string>()
    for (const sc of storeCheckouts) {
      if (!phone) break
      const customerId = randomUUID()
      batch.push(
        db.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${sc.storeId}:${phone}`}))`,
        ),
        db.execute(
          sql`INSERT INTO customers (id, store_id, name, phone, email, address)
              SELECT ${customerId}::uuid, ${sc.storeId}::uuid, ${customerName}, ${phone}, ${email || null}, ${address}
              WHERE NOT EXISTS (
                SELECT 1 FROM customers
                WHERE store_id = ${sc.storeId}::uuid AND phone = ${phone}
              )`,
        ),
      )
    }

    for (const op of simpleOps.values()) {
      batch.push(
        db.execute(
          sql`UPDATE products
              SET stock = GREATEST(stock - ${op.quantity}, 0)
              WHERE id = ${op.productId}
                AND store_id = ${op.storeId}
                AND stock >= ${op.quantity}`,
        ),
      )
    }

    for (const op of variantOps.values()) {
      variantProductKeys.add(`${op.storeId}:${op.productId}`)
      batch.push(
        db.execute(
          sql`UPDATE products
              SET variants = COALESCE((
                SELECT jsonb_agg(
                  CASE
                    WHEN v->>'id' = ${op.variantId}
                    THEN jsonb_set(
                      v,
                      '{stock}',
                      to_jsonb(GREATEST(COALESCE((v->>'stock')::int, 0) - ${op.quantity}, 0)),
                      true
                    )
                    ELSE v
                  END
                )
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(products.variants) = 'array' THEN products.variants
                    ELSE '[]'::jsonb
                  END
                ) AS v
              ), '[]'::jsonb)
              WHERE id = ${op.productId} AND store_id = ${op.storeId}`,
        ),
      )
    }

    // Le stock global d'un produit à variantes est recalculé à partir de la
    // matrice : il ne peut plus dériver après une vente ou une annulation.
    for (const key of variantProductKeys) {
      const [storeId, productId] = key.split(':')
      batch.push(
        db.execute(
          sql`UPDATE products
              SET stock = (
                SELECT COALESCE(SUM(GREATEST(COALESCE((v->>'stock')::int, 0), 0)), 0)
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(products.variants) = 'array' THEN products.variants
                    ELSE '[]'::jsonb
                  END
                ) AS v
              )
              WHERE id = ${productId} AND store_id = ${storeId}`,
        ),
      )
    }

    // Garde-fous post-décrément : si le stock ou le prix a changé entre la
    // lecture et la transaction, la division par zéro annule TOUTE la
    // transaction (Neon HTTP batch = une seule transaction).
    const wholesaleGuard = (
      applied: boolean,
      tiers: WholesaleTier[],
      price: number | null,
      minQty: number | null,
    ) => {
      if (!applied) return sql``
      return sql`AND COALESCE(p.wholesale_tiers, '[]'::jsonb) = ${JSON.stringify(tiers)}::jsonb
        AND p.wholesale_price IS NOT DISTINCT FROM ${price}
        AND p.wholesale_min_qty IS NOT DISTINCT FROM ${minQty}`
    }

    for (const op of simpleOps.values()) {
      batch.push(
        db.execute(
          sql`SELECT 1 / CASE WHEN EXISTS (
              SELECT 1 FROM products p
              WHERE p.id = ${op.productId}
                AND p.store_id = ${op.storeId}
                AND p.is_online = true
                AND p.price = ${op.expectedPrice}
                AND p.stock = ${op.expectedStock - op.quantity}
                AND COALESCE(p.options, '[]'::jsonb) = ${JSON.stringify(op.options)}::jsonb
                ${wholesaleGuard(op.wholesaleApplied, op.wholesaleTiers, op.wholesalePrice, op.wholesaleMinQty)}
            ) THEN 1 ELSE 0 END`,
        ),
      )
    }

    for (const op of variantOps.values()) {
      batch.push(
        db.execute(
          sql`SELECT 1 / CASE WHEN EXISTS (
              SELECT 1 FROM products p
              CROSS JOIN LATERAL jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(p.variants) = 'array' THEN p.variants
                  ELSE '[]'::jsonb
                END
              ) v
              WHERE p.id = ${op.productId}
                AND p.store_id = ${op.storeId}
                AND p.is_online = true
                AND v->>'id' = ${op.variantId}
                AND COALESCE((v->>'enabled')::boolean, true) = true
                AND (v->>'price')::numeric = ${op.expectedPrice}
                AND COALESCE((v->>'stock')::int, 0) = ${op.expectedStock - op.quantity}
                AND COALESCE(v->'optionValues', '{}'::jsonb) = ${JSON.stringify(op.optionValues)}::jsonb
                ${wholesaleGuard(op.wholesaleApplied, op.wholesaleTiers, op.wholesalePrice, op.wholesaleMinQty)}
            ) THEN 1 ELSE 0 END`,
        ),
      )
    }

    for (const sc of storeCheckouts) {
      const customerIdSql = phone
        ? sql`(SELECT id FROM customers WHERE store_id = ${sc.storeId} AND phone = ${phone} ORDER BY created_at ASC LIMIT 1)`
        : null

      batch.push(
        db.execute(
          sql`INSERT INTO orders (
                id, store_id, customer_id, buyer_user_id, buyer_email,
                total, subtotal, discount_amount, promo_code, payment_method,
                status, type, date
              ) VALUES (
                ${sc.orderId}::uuid, ${sc.storeId}::uuid, ${customerIdSql}, ${user?.id || null}::uuid, ${buyerEmail},
                ${sc.total}, ${sc.subtotal}, ${sc.discount}, ${sc.promoCode}, ${sc.paymentMethod},
                'PENDING', 'ONLINE', ${new Date()}
              )`,
        ),
      )

      if (sc.items.length > 0) {
        batch.push(
          db.insert(orderItems).values(
            sc.items.map((line) => ({
              orderId: sc.orderId,
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: String(roundMoney(line.unitPrice)),
              total: String(roundMoney(line.unitPrice * line.quantity)),
              variantId: line.variantId,
              variantLabel: line.variantLabel,
              variantSku: line.variantSku,
              variantOptionValues: line.variantOptionValues,
              productName: line.productName,
              productUnit: line.productUnit,
              productImage: line.productImage,
            })),
          ),
        )
      }

      if (phone) {
        batch.push(
          db.execute(
            sql`UPDATE customers
                SET total_spent = COALESCE(total_spent, 0) + ${sc.total},
                    orders_count = COALESCE(orders_count, 0) + 1
                WHERE store_id = ${sc.storeId} AND phone = ${phone}`,
          ),
        )
      }

      const salesByProduct = new Map<string, number>()
      for (const line of sc.items) {
        salesByProduct.set(
          line.productId,
          (salesByProduct.get(line.productId) || 0) + line.quantity,
        )
      }
      for (const [productId, quantity] of salesByProduct) {
        batch.push(
          db
            .insert(productStats)
            .values({ storeId: sc.storeId, productId, totalSales: quantity })
            .onConflictDoUpdate({
              target: productStats.productId,
              set: { totalSales: sql`COALESCE(${productStats.totalSales}, 0) + ${quantity}` },
            }),
        )
      }
    }

    const createdOrderIds = storeCheckouts.map((sc) => sc.orderId)
    if (key) {
      batch.push(
        db
          .update(checkoutIdempotency)
          .set({ orderIds: createdOrderIds })
          .where(eq(checkoutIdempotency.key, key)),
      )
    }

    if (batch.length === 0) reject('Aucune commande n’a pu être enregistrée.')

    await db.batch(batch as [BatchItem<'pg'>, ...BatchItem<'pg'>[]])
    completed = true

    // --- Notifications (best-effort, après le commit) ---------------------
    for (const sc of storeCheckouts) {
      try {
        const storeInfo = await getStorePhone(sc.storeId)
        const shortId = sc.orderId.slice(0, 8).toUpperCase()
        const totalStr = new Intl.NumberFormat('fr-FR').format(sc.total || 0)
        const emailProducts = await orderEmailProducts(sc.orderId)
        const paymentLabel = 'Espèces'

        if (storeInfo) {
          await notify({
            userId: storeInfo.ownerId,
            phone: storeInfo.phone,
            email: storeInfo.email || '',
            eventType: 'NOUVELLE_COMMANDE',
            title: 'Nouvelle commande',
            body: `Nouvelle commande ${shortId}\nClient : ${customerName}\nTotal : ${totalStr} FCFA\nPaiement : ${paymentLabel}`,
            templateParams: [shortId, customerName, totalStr],
            emailData: {
              order: shortId,
              orderId: sc.orderId,
              buyer: customerName,
              phone: phone || undefined,
              total: totalStr,
              payment: 'ESPECES',
              paymentLabel,
              items: emailProducts.length || undefined,
              store: storeInfo?.name || '',
              storeSlug: storeInfo?.slug || '',
              products: emailProducts,
            },
          })
          if (sc.customerCreated) {
            await notify({
              userId: storeInfo.ownerId,
              phone: storeInfo.phone,
              email: storeInfo.email || '',
              eventType: 'NOUVEAU_CLIENT',
              title: 'Nouveau client',
              body: `Nouveau client enregistré : ${customerName} (${phone})`,
              templateParams: [customerName, phone],
              emailData: {
                buyer: customerName,
                phone,
                store: storeInfo?.name || '',
                storeSlug: storeInfo?.slug || '',
              },
            })
          }
        }

        if (phone || email || user?.id) {
          await notify({
            userId: user?.id || null,
            phone,
            email,
            eventType: 'CONFIRMATION_COMMANDE',
            title: 'Commande confirmée',
            body: `Votre commande ${shortId} chez ${sc.storeName} est confirmée. Total : ${totalStr} FCFA.`,
            templateParams: [shortId, sc.storeName, totalStr],
            emailData: {
              order: shortId,
              orderId: sc.orderId,
              store: sc.storeName,
              storeSlug: storeInfo?.slug || '',
              total: totalStr,
              payment: 'ESPECES',
              paymentLabel,
              items: emailProducts.length || undefined,
              products: emailProducts,
            },
          })
        }

        const requestedProductIds = Array.from(
          new Set(sc.items.map((line) => line.productId)),
        )
        if (requestedProductIds.length > 0) {
          const lowProducts = await db
            .select({
              id: products.id,
              name: products.name,
              stock: products.stock,
              options: products.options,
              variants: products.variants,
            })
            .from(products)
            .where(inArray(products.id, requestedProductIds))

          for (const p of lowProducts) {
            const rawVariants = Array.isArray(p.variants)
              ? (p.variants as Array<{ name?: string; stock?: number; enabled?: boolean }>)
              : []
            const activeVariants = rawVariants.filter((v) => v.enabled !== false)
            const productSlug = generateProductSlug({ id: p.id, name: p.name })

            if (activeVariants.length > 0) {
              const lowVariants = activeVariants
                .map((v) => ({
                  name: String(v.name || 'Variante'),
                  stock: Math.max(0, Number(v.stock) || 0),
                }))
                .filter((v) => v.stock <= 10)
              if (lowVariants.length === 0 || !storeInfo) continue

              const ruptures = lowVariants.filter((v) => v.stock === 0)
              const isRupture = ruptures.length > 0
              await notify({
                userId: storeInfo.ownerId,
                phone: storeInfo.phone,
                email: storeInfo.email || '',
                eventType: isRupture ? 'RUPTURE_STOCK' : 'ALERTE_STOCK_BAS',
                title: isRupture ? 'Rupture de stock' : 'Stock bas',
                body: isRupture
                  ? `Rupture de stock : « ${p.name} » — ${ruptures
                      .map((v) => `${v.name} (0)`)
                      .join(', ')}.`
                  : `Stock bas : « ${p.name} » — ${lowVariants
                      .map((v) => `${v.name} (${v.stock})`)
                      .join(', ')}.`,
                templateParams: [p.name, lowVariants.map((v) => v.name).join(', ')],
                emailData: {
                  product: p.name,
                  productSlug,
                  stock: lowVariants[0]?.stock,
                },
              })
            } else {
              const stock = Math.max(0, Number(p.stock) || 0)
              if (stock > 10 || !storeInfo) continue
              await notify({
                userId: storeInfo.ownerId,
                phone: storeInfo.phone,
                email: storeInfo.email || '',
                eventType: stock === 0 ? 'RUPTURE_STOCK' : 'ALERTE_STOCK_BAS',
                title: stock === 0 ? 'Rupture de stock' : 'Stock bas',
                body:
                  stock === 0
                    ? `Rupture de stock : « ${p.name} » n’est plus disponible.`
                    : `Stock bas : « ${p.name} » — plus que ${stock} en stock.`,
                templateParams: [p.name, String(stock)],
                emailData: { product: p.name, productSlug, stock },
              })
            }
          }
        }
      } catch (error) {
        console.error('[checkout] notification error:', error)
      }
    }

    return {
      success: true as const,
      orderId: createdOrderIds[0],
      orderIds: createdOrderIds,
      orders: await loadCheckoutOrders(createdOrderIds),
      error: undefined,
    }
  } catch (error) {
    console.error('Error persisting marketplace order:', error)
    const isConflict =
      String(error).includes('division by zero') ||
      String(error).includes('division_by_zero') ||
      String(error).includes('22012')
    return {
      success: false as const,
      error: isConflict
        ? 'Le stock ou le prix d’un article a changé pendant la validation. Actualisez votre panier et réessayez.'
        : error instanceof CheckoutValidationError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Erreur lors de la validation de la commande',
    }
  } finally {
    if (ownsKey && !completed && key) {
      await db
        .delete(checkoutIdempotency)
        .where(eq(checkoutIdempotency.key, key))
        .catch(() => undefined)
    }
  }
}
