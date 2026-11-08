-- Index de performance pour l'espace vendeur (dashboard, POS, inventaire,
-- commandes). Créés de façon idempotente : rejouables sans risque.
--
-- - order_items(order_id) : chargement des lignes de commandes (IN (...)),
--   aujourd'hui sans index alors que c'est la requête la plus fréquente.
-- - orders(store_id, date) : liste des commandes d'une boutique triée par date.
-- - customers(store_id, created_at) : liste clients d'une boutique triée.
-- - stores(user_id) : résolution des boutiques d'un vendeur à chaque requête.
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "orders_store_date_idx" ON "orders" ("store_id", "date");
CREATE INDEX IF NOT EXISTS "customers_store_created_idx" ON "customers" ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "stores_user_id_idx" ON "stores" ("user_id");
