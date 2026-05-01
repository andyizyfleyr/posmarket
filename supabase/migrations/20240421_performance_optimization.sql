
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 1. INFRASTRUCTURE D'AUDIT
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT,
    record_id UUID,
    action TEXT,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. INDEXES STRATÉGIQUES
CREATE INDEX IF NOT EXISTS idx_availability_product_date_available ON availability_slots(product_id, date, is_available);
CREATE INDEX IF NOT EXISTS idx_availability_blocked ON availability_slots(product_id, date) WHERE is_available = false;
CREATE INDEX IF NOT EXISTS idx_order_items_product_order ON order_items(product_id, order_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

-- 3. TRIGGERS (Source de Vérité Absolue)

-- A. Stats Client
CREATE OR REPLACE FUNCTION fn_on_order_inserted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers 
    SET total_spent = total_spent + NEW.total,
        orders_count = orders_count + 1
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_order_inserted ON orders;
CREATE TRIGGER tr_order_inserted AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION fn_on_order_inserted();

-- B. Stock & Calendrier (Version Ultra-Blindée)
CREATE OR REPLACE FUNCTION fn_on_order_item_inserted()
RETURNS TRIGGER AS $$
SECURITY DEFINER
DECLARE
  v_old_p RECORD;
  v_new_stock INTEGER;
BEGIN
  -- 🔒 ADVISORY LOCK
  PERFORM pg_advisory_xact_lock(hashtext(NEW.product_id::text));

  -- 1. Lock & Load
  SELECT * INTO v_old_p FROM products WHERE id = NEW.product_id FOR UPDATE;

  IF v_old_p.business_type = 'stay' THEN
    -- 🏨 GESTION AIRBNB (include checkout day as occupied)
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM availability_slots 
        WHERE product_id = NEW.product_id AND is_available = false 
        AND date >= NEW.check_in::date AND date <= NEW.check_out::date
      ) THEN
        RAISE EXCEPTION 'Conflit de calendrier détecté.';
      END IF;

      INSERT INTO availability_slots (product_id, date, is_available, booking_id)
      SELECT NEW.product_id, d::date, false, NEW.order_id
      FROM generate_series(NEW.check_in::date, NEW.check_out::date, '1 day'::interval) AS d
      ON CONFLICT (product_id, date) DO UPDATE SET is_available = false, booking_id = NEW.order_id;
    END IF;
  ELSIF v_old_p.business_type = 'shopping' THEN
    -- 🛒 GESTION SHOPPING (Garde-fou atomique avec Returning)
    UPDATE products 
    SET stock = stock - NEW.quantity 
    WHERE id = NEW.product_id 
    AND stock >= NEW.quantity
    RETURNING stock INTO v_new_stock;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant pour % (Disponible: %)', v_old_p.name, v_old_p.stock;
    END IF;
  ELSE
    -- 🍔 UBEREATS: Pas de gestion de stock
    NULL;
  END IF;

  -- 📝 AUDIT LOG
  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data)
  VALUES ('order_items', NEW.id, 'PROCESS_ITEM', row_to_json(v_old_p)::jsonb, row_to_json(NEW)::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_order_item_inserted ON order_items;
CREATE TRIGGER tr_order_item_inserted AFTER INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION fn_on_order_item_inserted();

-- 4. RPCs

-- create_order_full (Idempotence & Transaction Safe)
CREATE OR REPLACE FUNCTION create_order_full(p_order JSONB, p_items JSONB)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
BEGIN
  -- 🚀 IDEMPOTENCE : Si la clé existe, on renvoie l'ID existant sans crash
  INSERT INTO orders (
    store_id, customer_id, subtotal, total, discount_amount, 
    promo_code, payment_method, status, type, date, idempotency_key
  ) VALUES (
    (p_order->>'store_id')::UUID, (p_order->>'customer_id')::UUID,
    (p_order->>'subtotal')::NUMERIC, (p_order->>'total')::NUMERIC,
    (p_order->>'discount_amount')::NUMERIC, p_order->>'promo_code',
    (p_order->>'payment_method'), (p_order->>'status'), (p_order->>'type'),
    (p_order->>'date')::TIMESTAMPTZ, (p_order->>'idempotency_key')
  ) 
  ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_order_id;

  -- On boucle sur les items (Les triggers gèrent l'intégrité)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, product_id, quantity, price, check_in, check_out, guests)
    VALUES (v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'price')::NUMERIC, (v_item->>'check_in')::DATE, (v_item->>'check_out')::DATE, (v_item->>'guests')::INTEGER)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- 5. RECHERCHE INTELLIGENTE (Full Text Search)
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector('french', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))
) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);
