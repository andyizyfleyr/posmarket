-- Enhance store_stats view to include global ratings and review counts
DROP VIEW IF EXISTS public.store_stats CASCADE;

CREATE VIEW public.store_stats AS
SELECT 
    s.id AS store_id,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM(o.total) AS total_revenue,
    COUNT(DISTINCT c.id) AS total_customers,
    COALESCE(pr_agg.average_rating, 0) AS average_rating,
    COALESCE(pr_agg.total_reviews, 0) AS total_reviews
FROM public.stores s
LEFT JOIN public.orders o ON s.id = o.store_id
LEFT JOIN public.customers c ON s.id = c.store_id
LEFT JOIN (
    -- Aggregate reviews across all products for each store
    SELECT 
        store_id, 
        AVG(rating) AS average_rating, 
        COUNT(id) AS total_reviews
    FROM public.product_reviews
    GROUP BY store_id
) pr_agg ON s.id = pr_agg.store_id
GROUP BY s.id, pr_agg.average_rating, pr_agg.total_reviews;

GRANT SELECT ON public.store_stats TO authenticated, anon;
