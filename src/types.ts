
export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  productId?: string;
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
  hasOptions?: boolean;
  unit?: string;
  description?: string;
  isOnline?: boolean;
  reviews?: Review[];
  rating?: number; // Average rating
  reviewCount?: number;
  salesCount?: number;
  views?: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
}

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  totalSpent: number;
  ordersCount: number;
  lastOrderDate?: string;
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  OTHER = 'OTHER'
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  discountAmount?: number;
  promoCode?: string;
  paymentMethod: PaymentMethod;
  customer?: Customer;
  type?: 'IN_STORE' | 'PICKUP';
  status?: 'PENDING' | 'READY' | 'COMPLETED';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customer?: Customer;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  total: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  notes?: string;
}

export type ViewType = 'dashboard' | 'pos' | 'orders' | 'inventory' | 'customers' | 'reports' | 'invoices' | 'settings' | 'storefront' | 'subscription' | 'admin'; // Core application views

export interface StoreSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  ninea: string;
  logo?: string;
  currency?: string;
  language?: string;
  description?: string;
}

// GiftCard interface removed as the feature is being deleted

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
  customers?: Customer[];
  orders?: Order[];
  invoices?: Invoice[];
  staff?: Staff[];
  ownerId?: string;
  subscription?: UserSubscription;
  views?: number;
  rating?: number;
  reviewCount?: number;
  user_id?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
}

export type SubscriptionDuration = 'demo' | 'monthly' | 'quarterly' | 'annual';
export type SubscriptionTier = 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface SubscriptionFeatures {
  maxStores: number;
  maxProducts: number;
  enableStorefront: boolean;
  enableAdvancedReports: boolean;
  enableCustomReceipts: boolean;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceQuarterly: number;
  priceAnnual: number;
  features: SubscriptionFeatures;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  duration: SubscriptionDuration;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

export type StaffRole = 'SUPER_ADMIN' | 'OWNER' | 'SELLER';

export interface StaffPermissions {
  canManageInventory: boolean;
  canManageCustomers: boolean;
  canManageOrders: boolean;
  canViewReports: boolean;
  canManageInvoices: boolean;
  canManageSettings: boolean;
  canManageStaff: boolean;
}

export interface Staff {
  id: string;
  userId: string;
  storeId: string;
  role: StaffRole;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  subscriptionTier?: SubscriptionTier;
  subscriptionDuration?: SubscriptionDuration;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  title?: string;
}

export interface Coupon {
  id?: string;
  code: string;
  discount_pct: number;
  active: boolean;
  store_id: string;
  created_at?: string;
}


