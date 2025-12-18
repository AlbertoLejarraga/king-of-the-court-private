-- Function to get advanced stats for a player
-- Returns: JSON object with total_matches, win_rate, favorite_rival, nemesis, frequent_rival, max_streak

CREATE OR REPLACE FUNCTION public.get_player_advanced_stats(target_player_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_total_wins int;
    v_total_losses int;
    v_total_matches int;
    v_win_rate int;
    
    v_favorite_rival jsonb;
    v_nemesis jsonb;
    v_frequent_rival jsonb;
    
    v_max_streak int;
BEGIN
    -- 1. Basic Stats (Wins/Losses from daily_stats is easier/faster if reliable, but matches table is source of truth for rivals)
    -- We can get aggregates from daily_stats for speed
    SELECT COALESCE(SUM(wins), 0), COALESCE(SUM(losses), 0), COALESCE(MAX(max_streak), 0)
    INTO v_total_wins, v_total_losses, v_max_streak
    FROM public.daily_stats
    WHERE player_id = target_player_id;

    v_total_matches := v_total_wins + v_total_losses;
    
    IF v_total_matches > 0 THEN
        v_win_rate := ROUND((v_total_wins::numeric / v_total_matches::numeric) * 100);
    ELSE
        v_win_rate := 0;
    END IF;

    -- 2. Favorite Rival (Most Wins Against)
    SELECT jsonb_build_object('name', p.name, 'count', COUNT(*))
    INTO v_favorite_rival
    FROM public.matches m
    JOIN public.players p ON m.loser_id = p.id
    WHERE m.winner_id = target_player_id
    GROUP BY p.name
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- 3. Kryptonite / Nemesis (Most Losses Against)
    SELECT jsonb_build_object('name', p.name, 'count', COUNT(*))
    INTO v_nemesis
    FROM public.matches m
    JOIN public.players p ON m.winner_id = p.id
    WHERE m.loser_id = target_player_id
    GROUP BY p.name
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- 4. Most Frequent Rival (Most Matches Played Against)
    WITH rival_matches AS (
        SELECT loser_id as rival_id FROM public.matches WHERE winner_id = target_player_id
        UNION ALL
        SELECT winner_id as rival_id FROM public.matches WHERE loser_id = target_player_id
    )
    SELECT jsonb_build_object('name', p.name, 'count', COUNT(*))
    INTO v_frequent_rival
    FROM rival_matches rm
    JOIN public.players p ON rm.rival_id = p.id
    GROUP BY p.name
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- Return Object
    RETURN jsonb_build_object(
        'total_matches', v_total_matches,
        'win_rate', v_win_rate,
        'max_streak', v_max_streak,
        'favorite_rival', COALESCE(v_favorite_rival, 'null'::jsonb),
        'nemesis', COALESCE(v_nemesis, 'null'::jsonb),
        'frequent_rival', COALESCE(v_frequent_rival, 'null'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
