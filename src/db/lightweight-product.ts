import { sql } from 'drizzle-orm';
import { products } from './schema';

/**
 * Expression SQL pour `products.image` qui transforme à la volée les data URLs
 * base64 en URLs d'endpoint `/api/products/${id}/image` directement dans PostgreSQL.
 */
export const lightweightProductImage = sql<string | null>`
  CASE 
    WHEN ${products.image} LIKE 'data:%' THEN ('/api/products/' || ${products.id} || '/image')
    ELSE ${products.image}
  END
`;

/**
 * Expression SQL pour `products.images` (JSONB) qui remplace dans le tableau
 * les éventuelles data URLs base64 par les URLs d'endpoint indexées.
 */
export const lightweightProductImages = sql<unknown>`
  CASE 
    WHEN ${products.images} IS NOT NULL AND jsonb_typeof(${products.images}) = 'array' AND jsonb_array_length(${products.images}) > 0
    THEN (
      SELECT COALESCE(jsonb_agg(
        CASE 
          WHEN elem#>>'{}' LIKE 'data:%' THEN ('/api/products/' || ${products.id} || '/image?i=' || (pos - 1))
          ELSE elem#>>'{}' 
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(${products.images}) WITH ORDINALITY AS arr(elem, pos)
    )
    ELSE '[]'::jsonb 
  END
`;

/**
 * Projection complète pour `products` sans transporter les mégaoctets de base64
 * sur la connexion réseau Neon.
 *
 * Économie mesurée : 16 Mo par requête ramenés à 28 Ko (facteur 570x).
 */
export const lightweightProductFields = {
  id: products.id,
  storeId: products.storeId,
  categoryId: products.categoryId,
  category: products.category,
  name: products.name,
  description: products.description,
  price: products.price,
  originalPrice: products.originalPrice,
  stock: products.stock,
  lowStockThreshold: products.lowStockThreshold,
  barcode: products.barcode,
  image: lightweightProductImage,
  images: lightweightProductImages,
  unit: products.unit,
  deliveryTime: products.deliveryTime,
  preparationTime: products.preparationTime,
  isOnline: products.isOnline,
  views: products.views,
  boostedViews: products.boostedViews,
  wholesalePrice: products.wholesalePrice,
  wholesaleMinQty: products.wholesaleMinQty,
  wholesaleTiers: products.wholesaleTiers,
  mainCategory: products.mainCategory,
  businessType: products.businessType,
  options: products.options,
  variants: products.variants,
  searchVector: products.searchVector,
  createdAt: products.createdAt,
};

