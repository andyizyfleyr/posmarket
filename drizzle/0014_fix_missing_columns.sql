-- Fix missing columns for existing installations
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_name') THEN
    ALTER TABLE profiles ADD COLUMN company_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ninea') THEN
    ALTER TABLE profiles ADD COLUMN ninea text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_super_admin') THEN
    ALTER TABLE profiles ADD COLUMN is_super_admin boolean DEFAULT false NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='account_type') THEN
    ALTER TABLE profiles ADD COLUMN account_type text DEFAULT 'buyer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email_verified') THEN
    ALTER TABLE profiles ADD COLUMN email_verified timestamp;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_tier') THEN
    ALTER TABLE profiles ADD COLUMN subscription_tier text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_duration') THEN
    ALTER TABLE profiles ADD COLUMN subscription_duration text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_status') THEN
    ALTER TABLE profiles ADD COLUMN subscription_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_start_date') THEN
    ALTER TABLE profiles ADD COLUMN subscription_start_date timestamp;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_end_date') THEN
    ALTER TABLE profiles ADD COLUMN subscription_end_date timestamp;
  END IF;
END ;

-- products
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='wholesale_tiers') THEN
    ALTER TABLE products ADD COLUMN wholesale_tiers jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='search_vector') THEN
    ALTER TABLE products ADD COLUMN search_vector text NOT NULL DEFAULT '';
  END IF;
END ;

-- order_items
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='variant_id') THEN
    ALTER TABLE order_items ADD COLUMN variant_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='variant_label') THEN
    ALTER TABLE order_items ADD COLUMN variant_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='variant_sku') THEN
    ALTER TABLE order_items ADD COLUMN variant_sku text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='variant_option_values') THEN
    ALTER TABLE order_items ADD COLUMN variant_option_values jsonb DEFAULT '{}'::jsonb;
  END IF;
END ;

-- stores
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stores' AND column_name='business_type') THEN
    ALTER TABLE stores ADD COLUMN business_type text DEFAULT 'shopping' NOT NULL;
  END IF;
END ;

-- orders
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='buyer_user_id') THEN
    ALTER TABLE orders ADD COLUMN buyer_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='buyer_email') THEN
    ALTER TABLE orders ADD COLUMN buyer_email text;
  END IF;
END ;

-- product_reviews
DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_reviews' AND column_name='user_id') THEN
    ALTER TABLE product_reviews ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END ;
