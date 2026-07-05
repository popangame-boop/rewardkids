-- ============================================================
-- Fix Storage Policies for 'proofs' bucket
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow own file deletion" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletion" ON storage.objects;

-- 2. Create new policies to support the upload structure of the app:
--    - Parents upload to: rewards/reward-...
--    - Children upload to: [childId]/...

-- INSERT: Any authenticated user can upload to 'proofs' bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'proofs');

-- SELECT: Any authenticated user can view files in 'proofs' bucket
CREATE POLICY "Allow authenticated reads" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'proofs');

-- DELETE: Any authenticated user can delete files in 'proofs' bucket
CREATE POLICY "Allow authenticated deletion" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'proofs');
