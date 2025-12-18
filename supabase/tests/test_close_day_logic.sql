-- TEST SCRIPT: Verify Close Day Logic (SAFE)
-- Runs inside a transaction and ROLLS BACK at the end.
-- No data will be permanently changed.

BEGIN;

-- 1. Setup Test Data
-- Create 2 dummy players
INSERT INTO public.players (id, name, created_at) VALUES 
('00000000-0000-0000-0000-000000000001', 'Test Player Streak', NOW()),
('00000000-0000-0000-0000-000000000002', 'Test Player Points', NOW());

-- Create Daily Stats for TODAY
-- Player 1: Low points, High Streak
INSERT INTO public.daily_stats (date, player_id, wins, losses, items_won, current_streak, max_streak, points)
VALUES (CURRENT_DATE, '00000000-0000-0000-0000-000000000001', 5, 0, 0, 5, 5, 10.0);

-- Player 2: High points, Low Streak
INSERT INTO public.daily_stats (date, player_id, wins, losses, items_won, current_streak, max_streak, points)
VALUES (CURRENT_DATE, '00000000-0000-0000-0000-000000000002', 3, 0, 0, 2, 2, 11.0);

-- 2. Execute Function
SELECT * FROM public.close_day_bonus(CURRENT_DATE);

-- 3. Verify Results
-- Player 1 should have received +2 points (Total 12)
-- Player 2 stays at 11.
-- Player 1 should be Day Winner (12 > 11) because they got the bonus and overtook Player 2.

SELECT player_id, points, max_streak FROM public.daily_stats WHERE date = CURRENT_DATE AND player_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- ROLLBACK to clean up
ROLLBACK;
