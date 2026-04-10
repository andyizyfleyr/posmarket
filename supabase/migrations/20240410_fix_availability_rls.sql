-- Fix to allow anonymous and authenticated buyers to book stays (block availability slots) during checkout

-- 1. Allow inserts of availability slots
DROP POLICY IF EXISTS "Public check out: insert availability" ON public.availability_slots;
CREATE POLICY "Public check out: insert availability" 
ON public.availability_slots FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- 2. Allow updates of availability slots
DROP POLICY IF EXISTS "Public check out: update availability" ON public.availability_slots;
CREATE POLICY "Public check out: update availability" 
ON public.availability_slots FOR UPDATE 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

-- 3. Grant permissions to anon and authenticated
GRANT INSERT, UPDATE ON public.availability_slots TO anon;
GRANT INSERT, UPDATE ON public.availability_slots TO authenticated;
