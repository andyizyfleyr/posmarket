/**
 * Types partagés — copie exacte du projet web (src/types.ts).
 * Seules les verticales `shopping` et `food` sont supportées.
 */

export interface Review {
  id: string;
  author: string;
  avatarUrl?: string | null;
  rating: number;
  comment: string;
  date: string;
  productId?: string;
  productName?: string | null;
  productImage?: string | null;
  sellerReply?: string | null;
}

export type BusinessVertical = 'shopping' | 'food';

export interface WholesaleTier {
  minQty: number;
  price: number;
  unitPrice?: number;
}

export interface Product {
  id: string;
  sku?: string;
  barcode?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  stock: number;
  category: string;
  mainCategory?: string;
  unit?: string;
  description?: string;
  isOnline?: boolean;
  reviews?: Review[];
  rating?: number;
  reviewCount?: number;
  salesCount?: number;
  views?: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  wholesaleTiers?: WholesaleTier[];
  deliveryTime?: string;
  options?: ProductOption[];
  variants?: ProductVariant[];
  businessType?: BusinessVertical;
  preparationTime?: string;
  /** Date de publication ISO — sert au classement « Nouveautés ». */
  createdAt?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  name: string;
  optionValues: Record<string, string>;
  price: number;
  stock: number;
  sku?: string;
  image?: string;
  /** Variante masquée côté acheteur quand `false`. */
  enabled?: boolean;
}

export interface CartItem {
  product: StorefrontProduct;
  quantity: number;
  variantId?: string;
  selectedOptions?: Record<string, string>;
}

export interface StoreSettings {
  businessType?: BusinessVertical;
  name: string;
  email: string;
  phone: string;
  address: string;
  country?: string;
  ninea: string;
  logo?: string;
  currency?: string;
  language?: string;
  description?: string;
  wholesaleEnabled?: boolean;
  wholesaleMinOrderAmount?: number;
}

export interface StoreData {
  id: string;
  slug?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  settings: StoreSettings;
  products?: Product[];
  views?: number;
  rating?: number;
  reviewCount?: number;
  business_type?: BusinessVertical;
}

export interface StorefrontProduct extends Product {
  storeId: string;
  storeName: string;
  storeSlug?: string;
  rankScore?: number;
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  title?: string;
}

/** Code promo — mêmes colonnes que la table `coupons` lue par le web. */
export interface Coupon {
  id?: string;
  code: string;
  discount_pct: number;
  active: boolean;
  store_id: string;
  created_at?: string;
}

// ── Espace acheteur (copie de `src/components/buyer/accountTypes.ts` web) ──

export interface BuyerOrderItem {
  id: string;
  quantity: number;
  price: number;
  products: Array<{
    id: string;
    name: string;
    image: string;
    business_type?: string;
  }>;
}

export interface BuyerOrder {
  id: string;
  date: string;
  total: number;
  subtotal: number;
  status: string;
  paymentMethod: string;
  store_id?: string;
  stores: Array<{ name?: string; business_type?: string }>;
  order_items: BuyerOrderItem[];
}

export interface BuyerAddress {
  id: string;
  name: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  is_default: boolean;
}

export interface BuyerReview {
  id: string;
  rating: number;
  comment: string;
  date?: string;
  stores: Array<{ name?: string }>;
  products: Array<{
    id: string;
    name: string;
    image: string;
    business_type?: string;
  }>;
}

/** Profil acheteur renvoyé par `/api/marketplace/buyer/profile`. */
export interface BuyerProfile {
  id?: string;
  email: string;
  /** Nom d'affichage (`name` pour la connexion, `fullName` pour le profil). */
  name?: string;
  fullName?: string;
  phone?: string;
  companyName?: string;
  ninea?: string;
  avatarUrl?: string | null;
}

export type BuyerTabId = 'orders' | 'addresses' | 'reviews' | 'notifications' | 'profile';

export interface NotificationPreference {
  eventType: string;
  label: string;
  optIn: boolean;
  whatsapp: { enabled: boolean; hasAddress: boolean; phone: string };
  email: { enabled: boolean; hasAddress: boolean; email: string };
}

export interface NotificationOutboxItem {
  id: string;
  eventType: string;
  title: string | null;
  body: string;
  provider: string;
  status: string;
  createdAt?: string;
}
