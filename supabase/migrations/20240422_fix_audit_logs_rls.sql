-- Fix RLS for audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert audit logs
CREATE POLICY "Allow insert audit logs for authenticated users" 
ON audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow service role to do everything
CREATE POLICY "Allow service role full access to audit_logs" 
ON audit_logs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create buyer_addresses table if not exists
CREATE TABLE IF NOT EXISTS buyer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for buyer_addresses
ALTER TABLE buyer_addresses ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own addresses
CREATE POLICY "Users can view own addresses" 
ON buyer_addresses FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow users to insert their own addresses
CREATE POLICY "Users can insert own addresses" 
ON buyer_addresses FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own addresses
CREATE POLICY "Users can update own addresses" 
ON buyer_addresses FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own addresses
CREATE POLICY "Users can delete own addresses" 
ON buyer_addresses FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role full access to buyer_addresses" 
ON buyer_addresses FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);