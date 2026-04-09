-- Migration: Add business_type to stores
ALTER TABLE stores ADD COLUMN business_type TEXT DEFAULT 'shopping' CHECK (business_type IN ('shopping', 'food', 'stay'));

-- Populate existing stores if necessary (default shopping is already set above)
UPDATE stores SET business_type = 'shopping' WHERE business_type IS NULL;
