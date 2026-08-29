export type BuyerOrderItem = {
  id: string;
  quantity: number;
  price: number;
  products: Array<{
    id: string;
    name: string;
    image: string;
    business_type?: string;
  }>;
};

export type BuyerOrder = {
  id: string;
  date: string;
  total: number;
  subtotal: number;
  status: string;
  paymentMethod: string;
  store_id?: string;
  stores: Array<{ name?: string; business_type?: string }>;
  order_items: BuyerOrderItem[];
};

export type BuyerAddress = {
  id: string;
  name: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  is_default: boolean;
};

export type BuyerReview = {
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
};

export type BuyerTabId = 'orders' | 'addresses' | 'reviews' | 'profile';

export type NotifyFn = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning',
  title?: string,
) => void;

export type BuyerOrdersResponse = {
  success: boolean;
  error?: string | undefined;
  totalCount: number;
  orders: BuyerOrder[];
};

export type SaveAddressPayload = {
  id?: string;
  name: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
};