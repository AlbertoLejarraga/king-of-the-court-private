CREATE OR REPLACE FUNCTION public.increment_cup_wins(p_player_id uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO public.league_standings (player_id, cup_wins)
    VALUES (p_player_id, 1)
    ON CONFLICT (player_id) 
    DO UPDATE SET 
        cup_wins = league_standings.cup_wins + 1,
        last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
