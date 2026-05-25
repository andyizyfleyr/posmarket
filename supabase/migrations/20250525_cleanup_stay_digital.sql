-- Cleanup: Remove 'stay' and 'digital' business types
-- Only keep 'shopping' and 'food'

-- 1. Update stores constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_business_type_check;
ALTER TABLE stores ADD CONSTRAINT stores_business_type_check CHECK (business_type IN ('shopping', 'food'));

-- 2. Convert existing 'stay' and 'digital' stores to 'shopping'
UPDATE stores SET business_type = 'shopping' WHERE business_type IN ('stay', 'digital');

-- 3. Remove stay/digital specific columns from products
ALTER TABLE products DROP COLUMN IF EXISTS amenities;
ALTER TABLE products DROP COLUMN IF EXISTS max_guests;
ALTER TABLE products DROP COLUMN IF EXISTS bedrooms;
ALTER TABLE products DROP COLUMN IF EXISTS location;
ALTER TABLE products DROP COLUMN IF EXISTS is_digital;
ALTER TABLE products DROP COLUMN IF EXISTS digital_url;

-- 4. Remove stay-specific columns from order_items
ALTER TABLE order_items DROP COLUMN IF EXISTS check_in;
ALTER TABLE order_items DROP COLUMN IF EXISTS check_out;
ALTER TABLE order_items DROP COLUMN IF EXISTS guests;

-- 5. Drop the availability_slots table (stay booking engine)
DROP TABLE IF EXISTS availability_slots CASCADE;

-- 6. Drop stay/digital related RPC functions
DROP FUNCTION IF EXISTS check_availability_bulk;

-- 7. Clean up products that have stay/digital business_type
UPDATE products SET business_type = 'shopping' WHERE business_type IN ('stay', 'digital', '');
