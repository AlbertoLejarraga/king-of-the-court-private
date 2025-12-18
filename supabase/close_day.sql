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
BEGIN
    -- 0. Check if there are any stats
    SELECT count(*) INTO v_stats_count FROM public.daily_stats WHERE date = p_date;
    IF v_stats_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No hay datos para esta fecha.');
    END IF;

    -- 1. Find the player with the highest max_streak for the day (Bonus Winner)
    SELECT player_id, max_streak INTO v_bonus_winner_id, v_bonus_streak
    FROM public.daily_stats
    WHERE date = p_date
    ORDER BY max_streak DESC, points DESC
    LIMIT 1;

    IF v_bonus_winner_id IS NOT NULL THEN
        -- 2. Award 2 points to the Bonus Winner
        UPDATE public.daily_stats
        SET points = points + 2
        WHERE date = p_date AND player_id = v_bonus_winner_id;
        
        -- Get name for bonus winner
        SELECT name INTO v_bonus_winner_name FROM public.players WHERE id = v_bonus_winner_id;
    END IF;

    -- 3. Find the Day Winner (Highest Points AFTER bonus)
    SELECT ds.player_id, p.name, ds.points 
    INTO v_day_winner_id, v_day_winner_name, v_day_winner_points
    FROM public.daily_stats ds
    JOIN public.players p ON ds.player_id = p.id
    WHERE ds.date = p_date
    ORDER BY ds.points DESC, ds.wins DESC, ds.max_streak DESC
    LIMIT 1;

    -- 4. Return Summary
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
        'message', 'Día cerrado correctamente.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
