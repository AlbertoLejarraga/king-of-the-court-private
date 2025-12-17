-- Phase 3: Global Ranking & Close Day Logic

-- 1. Create a table for Global League Standings
-- This table tracks cumulative stats that persist across days
CREATE TABLE IF NOT EXISTS public.league_standings (
    player_id uuid REFERENCES public.players(id) ON DELETE CASCADE PRIMARY KEY,
    day_wins int DEFAULT 0, -- How many times they finished #1
    total_points float DEFAULT 0, -- Tie-breaker or general accumulator
    last_updated timestamptz DEFAULT now()
);

-- 2. Create a table to track Closed Days (to prevent double closing)
CREATE TABLE IF NOT EXISTS public.closed_days (
    date date PRIMARY KEY,
    closed_at timestamptz DEFAULT now()
);

-- 3. Update the Close Day Function
CREATE OR REPLACE FUNCTION public.close_day_bonus(p_date date DEFAULT current_date)
RETURNS jsonb AS $$
DECLARE
    v_winner_id uuid;
    v_max_streak int;
    v_winner_name text;
    v_already_closed boolean;
BEGIN
    -- Check if already closed
    SELECT EXISTS(SELECT 1 FROM public.closed_days WHERE date = p_date) INTO v_already_closed;
    
    IF v_already_closed THEN
        RETURN jsonb_build_object('success', false, 'message', 'El día ya está cerrado.');
    END IF;

    -- 1. Find the player with the highest max_streak for the day (The Day Winner)
    -- Rule: Max Streak is the primary win condition for the +2 bonus and Day Win.
    SELECT player_id, max_streak INTO v_winner_id, v_max_streak
    FROM public.daily_stats
    WHERE date = p_date
    ORDER BY max_streak DESC, points DESC
    LIMIT 1;

    IF v_winner_id IS NOT NULL THEN
        -- 2. Award 2 points (Bonus)
        UPDATE public.daily_stats
        SET points = points + 2
        WHERE date = p_date AND player_id = v_winner_id;
        
        -- 3. Update Global League Standings (Increment Day Win)
        INSERT INTO public.league_standings (player_id, day_wins, total_points)
        VALUES (v_winner_id, 1, 0) -- Points will be updated separately if needed, or we just count wins
        ON CONFLICT (player_id) 
        DO UPDATE SET 
            day_wins = league_standings.day_wins + 1,
            last_updated = now();

        -- 4. Mark Day as Closed
        INSERT INTO public.closed_days (date) VALUES (p_date);
        
        -- Get name for return
        SELECT name INTO v_winner_name FROM public.players WHERE id = v_winner_id;

        RETURN jsonb_build_object(
            'success', true,
            'player', v_winner_name,
            'streak', v_max_streak,
            'message', 'Día cerrado. ¡Victoria para ' || v_winner_name || '!'
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'No stats found for this date');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
