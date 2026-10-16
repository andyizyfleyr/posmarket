export interface Product {
  id: string;
  storeId: string;
  storeName?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  images?: string[];
  description?: string;
  category?: string;
  vertical?: 'shopping' | 'food';
  stock?: number | null;
  salesCount?: number;
  views?: number;
  options?: Array<{
    name: string;
    values: string[];
  }>;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: Record<string, string>;
}
