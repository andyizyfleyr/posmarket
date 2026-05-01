'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveProductAction(product: any, storeId: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Non authentifié' };

  // 1. Check Limits for NEW products
  if (!product.id) {
    const [productsCountRes, profileRes] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
      supabase.from('profiles').select('subscription_tier').eq('id', session.user.id).single()
    ]);
    
    const count = productsCountRes.count || 0;
    const tier = profileRes.data?.subscription_tier || 'BASIC';
    const limit = tier === 'PRO' ? 500 : tier === 'ENTERPRISE' ? 999999 : 6;
    
    if (count >= limit) {
      return { success: false, error: `Limite de ${limit} produits atteinte pour votre abonnement ${tier}.` };
    }
  }

  // 2. Map camelCase to snake_case for Supabase
  const dbProduct = {
    ...(product.id && { id: product.id }),
    store_id: storeId,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    price: product.price,
    original_price: product.originalPrice || product.original_price,
    image: product.image,
    images: product.images || [],
    stock: product.stock,
    category: product.category,
    main_category: product.mainCategory || product.main_category,
    unit: product.unit,
    description: product.description,
    is_online: product.isOnline !== undefined ? product.isOnline : (product.is_online !== undefined ? product.is_online : true),
    views: product.views || 0,
    wholesale_price: product.wholesalePrice,
    wholesale_min_qty: product.wholesaleMinQty,
    business_type: product.businessType || (
      (product.mainCategory || '').includes('Séjour') || (product.mainCategory || '').includes('Immobilier') ? 'stay' :
      (product.mainCategory || '').includes('Resto') || (product.mainCategory || '').includes('Alimentation') ? 'food' :
      'shopping'
    ),
    amenities: product.amenities || [],
    max_guests: product.maxGuests,
    bedrooms: product.bedrooms,
    location: product.location,
    options: product.options || [],
    variants: product.variants || [],
    is_digital: product.isDigital || product.businessType === 'digital' || false,
    digital_url: product.businessType === 'digital' ? (product.digitalUrl || product.digital_url) : (product.digitalUrl || null)
  }

  const { data, error } = await supabase.from('products').upsert(dbProduct).select()

  if (error) {
    console.error('Error saving product:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/')
  revalidatePath('/[...slug]', 'page')
  return { success: true, product: data[0] }
}

export async function deleteProductAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)

  if (error) {
    console.error('Error deleting product:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/')
  revalidatePath('/[...slug]', 'page')
  return { success: true }
}

export async function bulkDeleteProductsAction(ids: string[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().in('id', ids)

  if (error) {
    console.error('Error bulk deleting products:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/')
  revalidatePath('/[...slug]', 'page')
  return { success: true }
}

export async function getProductsAction(
  storeId: string, 
  offset: number = 0, 
  limit: number = 10, 
  search: string = '',
  options: { productType?: 'all' | 'pos' | 'marketplace', businessType?: 'all' | 'shopping' | 'food' | 'stay' } = {}
) {
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.textSearch('search_vector', search, {
      type: 'websearch',
      config: 'french'
    });
  }

  if (options.productType && options.productType !== 'all') {
    if (options.productType === 'pos') {
      query = query.eq('is_online', false);
    } else if (options.productType === 'marketplace') {
      query = query.eq('is_online', true);
    }
  }

  if (options.businessType && options.businessType !== 'all') {
    query = query.eq('business_type', options.businessType);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    products: (data || []).map((p: any) => ({
      ...p,
      price: parseFloat(p.price) || 0,
      originalPrice: p.original_price ? parseFloat(p.original_price) : undefined,
      isOnline: p.is_online !== false,
      wholesalePrice: p.wholesale_price ? parseFloat(p.wholesale_price) : undefined,
      wholesaleMinQty: p.wholesale_min_qty,
      mainCategory: p.main_category,
      businessType: p.business_type,
      amenities: p.amenities || [],
      maxGuests: p.max_guests,
      bedrooms: p.bedrooms,
      location: p.location,
      options: p.options || [],
      variants: p.variants || [],
      isDigital: p.is_digital || false,
      digitalUrl: p.digital_url || ''
    })),
    hasMore: (count || 0) > (offset + (data?.length || 0)),
    total: count
  };
}
