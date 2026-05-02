-- Migration: Add 'digital' to stores business_type check constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_business_type_check;
ALTER TABLE stores ADD CONSTRAINT stores_business_type_check CHECK (business_type IN ('shopping', 'food', 'stay', 'digital'));