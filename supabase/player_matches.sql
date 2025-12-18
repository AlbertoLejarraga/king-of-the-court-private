-- Function to get recent matches for a player
-- Returns: JSON list of matches with opponent name and result

CREATE OR REPLACE FUNCTION public.get_player_matches(target_player_id uuid, limit_count int DEFAULT 20)
RETURNS TABLE (
    match_id uuid,
    created_at timestamptz,
    winner_id uuid,
    loser_id uuid,
    winner_name text,
    loser_name text,
    points_awarded float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id as match_id,
        m.created_at,
        m.winner_id,
        m.loser_id,
        w.name as winner_name,
        l.name as loser_name,
        m.points_awarded
    FROM public.matches m
    JOIN public.players w ON m.winner_id = w.id
    JOIN public.players l ON m.loser_id = l.id
    WHERE m.winner_id = target_player_id OR m.loser_id = target_player_id
    ORDER BY m.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
