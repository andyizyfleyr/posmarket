-- Functions to increment views atomically and bypass RLS for counters
CREATE OR REPLACE FUNCTION public.increment_product_views(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_store_views(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.stores
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to anonymous users to call these functions
GRANT EXECUTE ON FUNCTION public.increment_product_views(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_store_views(UUID) TO anon, authenticated;
