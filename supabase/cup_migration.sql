-- 1. Update existing tables
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'regular';
ALTER TABLE public.league_standings ADD COLUMN IF NOT EXISTS cup_wins int DEFAULT 0;

-- 2. Create Cups table
CREATE TABLE IF NOT EXISTS public.cups (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text DEFAULT 'Matapi''s Cup 2025',
    status text DEFAULT 'setup', -- setup, groups, finals, finished
    finals_mode text DEFAULT 'none', -- none, semi_final_final, third_fourth_semi_final, only_final
    created_at timestamptz DEFAULT now(),
    winner_id uuid REFERENCES public.players(id)
);

-- 3. Create Cup Players (for group assignment)
CREATE TABLE IF NOT EXISTS public.cup_players (
    cup_id uuid REFERENCES public.cups(id) ON DELETE CASCADE,
    player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
    group_name text, -- 'A' or 'B'
    PRIMARY KEY (cup_id, player_id)
);

-- 4. Create Cup Matches (or use the main matches table with match_type)
-- The user said: "almacenando el resultado de este partido y actualizando la clasificación"
-- "Los partidos jugados bajo la modalidad de copa contarán para el número de victorias totales pero no para el ranking diario"
-- I will use the main matches table for "victorias totales" counting, 
-- but I might need a specific cup_matches table to store the group/bracket context 
-- if I want to keep the main matches table clean. 
-- Actually, the user wants them to count for total wins. 
-- If I add them to `matches` with `match_type = 'cup'` and `points_awarded = 0`, they will count for `player_total_wins` view.
-- However, for the cup bracket and group phase, I need to know which cup and which phase they belong to.

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cup_id uuid REFERENCES public.cups(id);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cup_phase text; -- 'group', 'semi', 'final', 'third_fourth'

-- Update player_total_wins view to ensure it counts all matches (it already does)
-- CREATE OR REPLACE VIEW public.player_total_wins AS
-- SELECT 
--     p.id as player_id,
--     p.name,
--     COUNT(m.id) as total_wins
-- FROM public.players p
-- LEFT JOIN public.matches m ON p.id = m.winner_id
-- GROUP BY p.id;

-- Update the undo_last_match function to handle match_type
CREATE OR REPLACE FUNCTION public.undo_last_match(p_match_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_match_id uuid;
    v_winner_id uuid;
    v_loser_id uuid;
    v_match_date date;
    v_match_type text;
    v_player_ids uuid[];
    v_pid uuid;
    v_already_closed boolean;
    
    -- Recalculation variables
    v_wins int;
    v_losses int;
    v_points float;
    v_current_streak int;
    v_max_streak int;
    
    v_m record;
    v_affected_rows int := 0;
BEGIN
    -- 1. Identify the match
    IF p_match_id IS NOT NULL THEN
        SELECT id, winner_id, loser_id, created_at::date, match_type
        INTO v_match_id, v_winner_id, v_loser_id, v_match_date, v_match_type
        FROM public.matches
        WHERE id = p_match_id;
    ELSE
        SELECT id, winner_id, loser_id, created_at::date, match_type
        INTO v_match_id, v_winner_id, v_loser_id, v_match_date, v_match_type
        FROM public.matches
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_match_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró el partido para eliminar.');
    END IF;

    -- 2. Security: Check if the day is already closed (only for regular matches)
    IF v_match_type = 'regular' THEN
        SELECT EXISTS(SELECT 1 FROM public.closed_days WHERE date = v_match_date) INTO v_already_closed;
        IF v_already_closed THEN
            RETURN jsonb_build_object('success', false, 'message', 'No se puede anular un partido de un día ya cerrado (Fecha: ' || v_match_date || ').');
        END IF;
    END IF;

    -- 3. Delete the match
    DELETE FROM public.matches WHERE id = v_match_id;

    -- 4. Recalculate stats for BOTH players (if it was a regular match)
    IF v_match_type = 'regular' THEN
        v_player_ids := ARRAY[v_winner_id, v_loser_id];

        FOREACH v_pid IN ARRAY v_player_ids LOOP
            -- Initialize
            v_wins := 0;
            v_losses := 0;
            v_points := 0;
            v_current_streak := 0;
            v_max_streak := 0;

            -- Iterate through all matches of that player on that day in chronological order
            -- ONLY regular matches count for daily_stats
            FOR v_m IN (
                SELECT winner_id, loser_id, points_awarded
                FROM public.matches
                WHERE (winner_id = v_pid OR loser_id = v_pid)
                  AND created_at::date = v_match_date
                  AND match_type = 'regular'
                ORDER BY created_at ASC
            ) LOOP
                IF v_m.winner_id = v_pid THEN
                    v_wins := v_wins + 1;
                    v_points := v_points + v_m.points_awarded;
                    v_current_streak := v_current_streak + 1;
                    v_max_streak := greatest(v_max_streak, v_current_streak);
                ELSE
                    v_losses := v_losses + 1;
                    v_current_streak := 0;
                END IF;
            END LOOP;

            -- Update daily_stats
            UPDATE public.daily_stats
            SET 
                wins = v_wins,
                losses = v_losses,
                points = v_points,
                current_streak = v_current_streak,
                max_streak = v_max_streak
            WHERE date = v_match_date AND player_id = v_pid;
            
            -- If after deletion they have 0 matches, delete the stat row
            IF (v_wins + v_losses) = 0 THEN
                DELETE FROM public.daily_stats WHERE date = v_match_date AND player_id = v_pid;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Partido anulado correctamente.',
        'match_id', v_match_id,
        'match_type', v_match_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
