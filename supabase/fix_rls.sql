-- PATCH: Fix RLS Error
-- Run this in Supabase SQL Editor to allow the function to update the stats table.

-- 1. Make the scoring function run as "System" (bypassing RLS for the internal logic)
ALTER FUNCTION public.report_match(uuid, uuid) SECURITY DEFINER;

-- 2. (Optional backup) Allow public to update stats directly if needed
CREATE POLICY "Allow public all" ON public.daily_stats FOR ALL USING (true) WITH CHECK (true);
