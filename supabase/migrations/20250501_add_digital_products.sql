-- Add digital product support
-- is_digital: boolean to mark product as digital
-- digital_url: external download link (Google Drive, Dropbox, etc.)

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_digital boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS digital_url text;

-- RLS: Allow read access to digital product fields for buyers who purchased the product
-- This will be enforced at the application level for security