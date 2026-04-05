-- Reconcile author columns in product_reviews table
DO $$ 
BEGIN 
    -- 1. Ensure author_name exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_reviews' AND column_name='author_name') THEN
        ALTER TABLE public.product_reviews ADD COLUMN author_name TEXT;
    END IF;

    -- 2. If author column exists, migrate data and make it nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_reviews' AND column_name='author') THEN
        -- Transfer data
        UPDATE public.product_reviews SET author_name = author WHERE author_name IS NULL;
        
        -- Make author nullable to avoid NOT NULL constraint errors
        ALTER TABLE public.product_reviews ALTER COLUMN author DROP NOT NULL;
    END IF;

    -- 3. Ensure author_name is NOT NULL for future entries (only if it has data)
    ALTER TABLE public.product_reviews ALTER COLUMN author_name SET NOT NULL;
END $$;
