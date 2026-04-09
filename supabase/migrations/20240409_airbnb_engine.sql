-- 1. Add structured columns to products for Stays (Airbnb style)
ALTER TABLE products ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_guests INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'shopping';

-- 2. Create Availability Slots table for precise calendar management
CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT true,
    price_override NUMERIC,
    booking_id UUID, -- Links to orders(id) when booked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(product_id, date)
);

-- 3. Add booking details to order_items to track stay dates
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS check_in DATE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS check_out DATE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS guests INTEGER;

-- 4. Enable RLS for the new table
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- 5. Policies for availability_slots
-- Anyone can see availability
CREATE POLICY "Public can view availability" ON availability_slots
    FOR SELECT USING (true);

-- Only store owners/staff can manage availability
CREATE POLICY "Owners can manage availability" ON availability_slots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM products p
            JOIN stores s ON p.store_id = s.id
            WHERE p.id = availability_slots.product_id
            AND (s.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM store_staff ss WHERE ss.store_id = s.id AND ss.user_id = auth.uid()
            ))
        )
    );

-- 6. Indices for performance
CREATE INDEX IF NOT EXISTS idx_availability_product_date ON availability_slots(product_id, date);
CREATE INDEX IF NOT EXISTS idx_products_business_type ON products(business_type);
