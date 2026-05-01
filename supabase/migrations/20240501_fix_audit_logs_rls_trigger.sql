-- Fix RLS policy for audit_logs trigger
-- Add SECURITY DEFINER to trigger functions to bypass RLS

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

CREATE OR REPLACE FUNCTION fn_on_order_item_inserted()
RETURNS TRIGGER AS $$
DECLARE
  v_old_p RECORD;
  v_new_stock INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.product_id::text));

  SELECT * INTO v_old_p FROM products WHERE id = NEW.product_id FOR UPDATE;

  IF v_old_p.business_type = 'stay' THEN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM availability_slots 
        WHERE product_id = NEW.product_id AND is_available = false 
        AND date >= NEW.check_in::date AND date <= (NEW.check_out::date - 1)::date
      ) THEN
        RAISE EXCEPTION 'Conflit de calendrier détecté.';
      END IF;

      INSERT INTO availability_slots (product_id, date, is_available, booking_id)
      SELECT NEW.product_id, d::date, false, NEW.order_id
      FROM generate_series(NEW.check_in::date, (NEW.check_out::date - 1)::date, '1 day'::interval) AS d
      ON CONFLICT (product_id, date) DO UPDATE SET is_available = false, booking_id = NEW.order_id;
    END IF;
  ELSIF v_old_p.business_type = 'shopping' THEN
    UPDATE products 
    SET stock = stock - NEW.quantity 
    WHERE id = NEW.product_id 
    AND stock >= NEW.quantity
    RETURNING stock INTO v_new_stock;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant pour % (Disponible: %)', v_old_p.name, v_old_p.stock;
    END IF;
  ELSE
    NULL;
  END IF;

  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data)
  VALUES ('order_items', NEW.id, 'PROCESS_ITEM', row_to_json(v_old_p)::jsonb, row_to_json(NEW)::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;