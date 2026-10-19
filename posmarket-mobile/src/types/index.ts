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
