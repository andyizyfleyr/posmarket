-- Add options and variants columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- Update existing rows to have empty arrays if they are null
UPDATE public.products SET options = '[]'::jsonb WHERE options IS NULL;
UPDATE public.products SET variants = '[]'::jsonb WHERE variants IS NULL;
