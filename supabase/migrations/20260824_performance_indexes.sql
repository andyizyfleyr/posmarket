-- 20260824_performance_indexes.sql
-- Index sur les colonnes utilisées par les requêtes chaudes du storefront.
-- Idempotent (CREATE INDEX IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_is_online ON products (is_online);
CREATE INDEX IF NOT EXISTS idx_products_store_online ON products (store_id, is_online);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders (store_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON invoices (store_id);
