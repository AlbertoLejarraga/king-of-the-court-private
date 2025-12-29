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
    v_bonus_winner_id uuid;
    v_bonus_winner_name text;
    v_bonus_streak int;
    
    v_day_winner_id uuid;
    v_day_winner_name text;
    v_day_winner_points float;
    
    v_stats_count int;
    v_already_closed boolean;
BEGIN
    -- 0. Check if already closed
    SELECT EXISTS(SELECT 1 FROM public.closed_days WHERE date = p_date) INTO v_already_closed;
    IF v_already_closed THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este día ya ha sido cerrado previamente.');
    END IF;

    -- 1. Check if there are any stats
    SELECT count(*) INTO v_stats_count FROM public.daily_stats WHERE date = p_date;
    IF v_stats_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No hay datos para esta fecha.');
    END IF;

    -- 2. Find the player with the highest max_streak for the day (Bonus Winner)
    -- This player gets +2 points
    SELECT player_id, max_streak INTO v_bonus_winner_id, v_bonus_streak
    FROM public.daily_stats
    WHERE date = p_date
    ORDER BY max_streak DESC, points DESC
    LIMIT 1;

    IF v_bonus_winner_id IS NOT NULL THEN
        -- 3. Award 2 points to the Bonus Winner
        UPDATE public.daily_stats
        SET points = points + 2
        WHERE date = p_date AND player_id = v_bonus_winner_id;
        
        -- Get name for bonus winner
        SELECT name INTO v_bonus_winner_name FROM public.players WHERE id = v_bonus_winner_id;
    END IF;

    -- 4. Find the Day Winner (Highest Points AFTER bonus)
    -- This is the official champion of the day
    SELECT ds.player_id, p.name, ds.points 
    INTO v_day_winner_id, v_day_winner_name, v_day_winner_points
    FROM public.daily_stats ds
    JOIN public.players p ON ds.player_id = p.id
    WHERE ds.date = p_date
    ORDER BY ds.points DESC, ds.wins DESC, ds.max_streak DESC
    LIMIT 1;

    -- 5. Update Global League Standings (Increment Day Win for the champion)
    IF v_day_winner_id IS NOT NULL THEN
        INSERT INTO public.league_standings (player_id, day_wins, total_points)
        VALUES (v_day_winner_id, 1, v_day_winner_points)
        ON CONFLICT (player_id) 
        DO UPDATE SET 
            day_wins = league_standings.day_wins + 1,
            total_points = league_standings.total_points + v_day_winner_points,
            last_updated = now();
    END IF;

    -- 6. Mark Day as Closed
    INSERT INTO public.closed_days (date) VALUES (p_date);

    -- 7. Return Summary for the Frontend Modal
    RETURN jsonb_build_object(
        'success', true,
        'bonus_winner', jsonb_build_object(
            'name', v_bonus_winner_name,
            'streak', v_bonus_streak
        ),
        'day_winner', jsonb_build_object(
            'name', v_day_winner_name,
            'points', v_day_winner_points
        ),
        'message', 'Día cerrado correctamente. ¡Victoria para ' || v_day_winner_name || '!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
