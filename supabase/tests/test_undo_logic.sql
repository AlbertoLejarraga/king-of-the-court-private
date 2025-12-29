-- TEST SCRIPT: Verify Undo Match Logic
BEGIN;

-- 1. Setup Test Data
INSERT INTO public.players (id, name) VALUES 
('00000000-0000-0000-0000-000000000001', 'Winner Test'),
('00000000-0000-0000-0000-000000000002', 'Loser Test');

-- 2. Report First Match
SELECT public.report_match('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Check stats
SELECT 'After 1st match' as marker, player_id, wins, losses, current_streak, points FROM public.daily_stats WHERE date = CURRENT_DATE;

-- 3. Report Second Match
SELECT public.report_match('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Check stats
SELECT 'After 2nd match' as marker, player_id, wins, losses, current_streak, points FROM public.daily_stats WHERE date = CURRENT_DATE;

-- 4. UNDO last match
SELECT public.undo_last_match();

-- 5. Verify Results
-- Should be identical to "After 1st match"
SELECT 'After UNDO' as marker, player_id, wins, losses, current_streak, points FROM public.daily_stats WHERE date = CURRENT_DATE;

-- Check if match was actually deleted
SELECT COUNT(*) as match_count FROM public.matches WHERE winner_id = '00000000-0000-0000-0000-000000000001';

-- 6. UNDO second time (undoing the 1st match)
SELECT public.undo_last_match();

-- 7. Verify Results
-- daily_stats should be empty or back to zero (in our case we delete the row if 0 matches)
SELECT 'After 2nd UNDO' as marker, player_id, wins, losses, current_streak, points FROM public.daily_stats WHERE date = CURRENT_DATE;

ROLLBACK;
