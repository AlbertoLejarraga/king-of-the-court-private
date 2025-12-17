-- Phase 3b: reset logic + match-based history

-- 1. Ensure league_standings exists (from prev step)
CREATE TABLE IF NOT EXISTS public.league_standings (
    player_id uuid REFERENCES public.players(id) ON DELETE CASCADE PRIMARY KEY,
    day_wins int DEFAULT 0,
    total_points float DEFAULT 0,
    last_updated timestamptz DEFAULT now()
);

-- 2. Update Close Day Function with DELETE logic
-- This banks the win into the permanent table, then CLEARS the daily board.
CREATE OR REPLACE FUNCTION public.close_day_bonus(p_date date DEFAULT current_date)
RETURNS jsonb AS $$
DECLARE
    v_winner_id uuid;
    v_winner_name text;
    v_max_streak int;
BEGIN
    -- 1. Find the player with the highest max_streak for the day (The Day Winner)
    SELECT player_id, max_streak INTO v_winner_id, v_max_streak
    FROM public.daily_stats
    WHERE date = p_date
    ORDER BY max_streak DESC, points DESC
    LIMIT 1;

    IF v_winner_id IS NOT NULL THEN
        -- 2. Update Global League Standings (Increment Day Win)
        INSERT INTO public.league_standings (player_id, day_wins, total_points)
        VALUES (v_winner_id, 1, 0)
        ON CONFLICT (player_id) 
        DO UPDATE SET 
            day_wins = league_standings.day_wins + 1,
            last_updated = now();
            
        -- 3. Get name for return message
        SELECT name INTO v_winner_name FROM public.players WHERE id = v_winner_id;

        -- 4. RESET DAILY STATS (The "Zero" requirement)
        -- We delete the stats for today so the board becomes empty.
        -- Match history is preserved in `public.matches`.
        DELETE FROM public.daily_stats WHERE date = p_date;

        RETURN jsonb_build_object(
            'success', true,
            'player', v_winner_name,
            'message', '¡Día finalizado! Victoria para ' || v_winner_name || '. El ranking diario se ha reiniciado.'
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'No hay datos para cerrar hoy.');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper View for Total Wins (aggregating matches, since we delete daily_stats)
CREATE OR REPLACE VIEW public.player_total_wins AS
SELECT 
    p.id as player_id,
    p.name,
    COUNT(m.id) as total_wins
FROM public.players p
LEFT JOIN public.matches m ON p.id = m.winner_id
GROUP BY p.id;
