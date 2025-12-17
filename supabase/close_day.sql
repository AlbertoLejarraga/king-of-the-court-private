-- Function: Close Day / Award Bonus
-- This function finds the player with the max streak for the given date (default today)
-- and awards them 2 extra points.
-- It is idempotent-ish: if you run it multiple times, it adds points again. 
-- In a real prod app, we'd have a "is_day_closed" flag. For simplicity/fun, we allow manual trigger.

CREATE OR REPLACE FUNCTION public.close_day_bonus(p_date date DEFAULT current_date)
RETURNS jsonb AS $$
DECLARE
    v_winner_id uuid;
    v_max_streak int;
    v_player_name text;
BEGIN
    -- 1. Find the player with the highest max_streak for the day
    SELECT player_id, max_streak INTO v_winner_id, v_max_streak
    FROM public.daily_stats
    WHERE date = p_date
    ORDER BY max_streak DESC, points DESC -- Tie-breaker: Points
    LIMIT 1;

    IF v_winner_id IS NOT NULL THEN
        -- 2. Award 2 points
        UPDATE public.daily_stats
        SET points = points + 2
        WHERE date = p_date AND player_id = v_winner_id;
        
        -- Get name for return
        SELECT name INTO v_player_name FROM public.players WHERE id = v_winner_id;

        RETURN jsonb_build_object(
            'success', true,
            'player', v_player_name,
            'streak', v_max_streak,
            'message', 'Bonus awarded to ' || v_player_name
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'No stats found for this date');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
