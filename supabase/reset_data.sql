-- ⚠️ DANGER: This script deletes ALL match data and statistics.
-- It keeps the 'players' table so you don't have to re-enter names.

BEGIN;

    -- Truncate tables with cascade to handle foreign keys
    TRUNCATE TABLE public.matches CASCADE;
    TRUNCATE TABLE public.daily_stats CASCADE;
    TRUNCATE TABLE public.league_standings CASCADE;
    TRUNCATE TABLE public.closed_days CASCADE;

    -- Note: 'current_king' is a view, so it updates automatically when matches are deleted.

COMMIT;

-- Instructions:
-- 1. Copy this code.
-- 2. Go to Supabase -> SQL Editor.
-- 3. Paste and Run.
-- 4. Result: All match history is gone, but players remain.
