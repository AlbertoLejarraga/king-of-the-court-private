-- Esquema para el Modo Parejas (Doubles Mode)
-- Ejecutar en el SQL Editor de Supabase

-- 1. Tabla de Equipos / Parejas
create table if not exists public.doubles_teams (
    id uuid primary key default uuid_generate_v4(),
    name text not null, -- Ej "Alberto & Matapi"
    player1_id uuid references public.players(id),
    player2_id uuid references public.players(id),
    created_at timestamptz default now()
    -- Idealmente, uniqueness entre p1 y p2: pero lo controlaremos desde el cliente ordenando los IDs
);

-- Evitar duplicados de parejas asegurando que la combinación de jugadores es única
-- Requerimos que player1_id siempre sea menor que player2_id para la constraint (opcional, pero buena práctica)
create unique index if not exists idx_doubles_teams_unique_combination on public.doubles_teams (
    least(player1_id, player2_id),
    greatest(player1_id, player2_id)
);

-- 2. Daily Stats para Equipos
create table if not exists public.doubles_daily_stats (
    date date not null default current_date,
    team_id uuid references public.doubles_teams(id) on delete cascade,
    points float default 0,
    wins int default 0,
    losses int default 0,
    current_streak int default 0,
    max_streak int default 0,
    rank int,
    created_at timestamptz default now(),
    primary key (date, team_id)
);

-- 3. Tabla de Partidos de Parejas
create table if not exists public.doubles_matches (
    id uuid primary key default uuid_generate_v4(),
    winner_team_id uuid references public.doubles_teams(id),
    loser_team_id uuid references public.doubles_teams(id),
    is_king_defense boolean default false,
    points_awarded float not null,
    created_at timestamptz default now()
);

-- 4. Vista para el "Rey de la Pista" en Parejas
create or replace view public.doubles_current_king as
select winner_team_id as team_id
from public.doubles_matches
order by created_at desc
limit 1;

-- 5. Tabla para el ranking global de Parejas (Opcional phase3, lo creamos para victorias de copa o día)
create table if not exists public.doubles_league_standings (
    team_id uuid references public.doubles_teams(id) on delete cascade primary key,
    day_wins int default 0,
    total_points float default 0,
    cup_wins int default 0,
    last_updated timestamptz default now()
);

-- 6. Helper View for individual player win percentages
create or replace view public.player_win_percentages as
select 
    p.id as player_id,
    p.name,
    count(m.id) as total_matches,
    count(m.id) filter (where m.winner_id = p.id) as wins,
    case when count(m.id) = 0 then 0
    else round((count(m.id) filter (where m.winner_id = p.id)::numeric / count(m.id)::numeric) * 100, 2)
    end as win_pct
from public.players p
left join public.matches m on (m.winner_id = p.id or m.loser_id = p.id)
group by p.id, p.name;

-- 6b. Vista para "Victorias Totales" de Parejas
create or replace view public.doubles_total_wins as
with team_stats as (
    select
        t.id as team_id,
        t.name,
        t.player1_id,
        t.player2_id,
        count(m.id) filter (where m.winner_team_id = t.id) as total_wins,
        count(m.id) as total_matches,
        case
            when count(m.id) = 0 then 0
            else round((count(m.id) filter (where m.winner_team_id = t.id)::numeric / count(m.id)::numeric) * 100, 2)
        end as win_percentage
    from public.doubles_teams t
    left join public.doubles_matches m on (m.winner_team_id = t.id or m.loser_team_id = t.id)
    group by t.id, t.name, t.player1_id, t.player2_id
)
select 
    ts.team_id,
    ts.name,
    ts.total_wins,
    ts.total_matches,
    ts.win_percentage,
    p1.name as p1_name,
    coalesce(p1.win_pct, 0) as p1_win_pct,
    p2.name as p2_name,
    coalesce(p2.win_pct, 0) as p2_win_pct,
    round((coalesce(p1.win_pct, 0) + coalesce(p2.win_pct, 0)) / 2.0, 2) as team_avg_win_pct
from team_stats ts
left join public.player_win_percentages p1 on ts.player1_id = p1.player_id
left join public.player_win_percentages p2 on ts.player2_id = p2.player_id;

-- 7. Función Principal para Reportar Partido (Lógica V2 adaptada a Equipos)
create or replace function public.report_doubles_match(
    p_winner_team_id uuid,
    p_loser_team_id uuid
) returns jsonb as $$
declare
    v_today date := current_date;
    v_yesterday date := current_date - 1;
    
    v_winner_streak int;
    v_winner_points float;
    
    v_loser_matches_today int;
    v_daily_percentile float := 0.5;
    v_global_percentile float := 0.5;
    v_composite_percentile float;
    
    v_base_points float;
    v_king_bonus float := 0;
    v_opponent_multiplier float := 1.0;
    v_final_points float;
    
    v_current_king_team_id uuid;
    v_king_streak int := 0;
begin
    -- King Status
    select team_id into v_current_king_team_id from public.doubles_current_king;
    
    -- Inicializar Daily Stats si no existen hoy
    insert into public.doubles_daily_stats (date, team_id, points, wins, losses, current_streak, max_streak)
    values (v_today, p_winner_team_id, 0, 0, 0, 0, 0)
    on conflict (date, team_id) do nothing;
    
    insert into public.doubles_daily_stats (date, team_id, points, wins, losses, current_streak, max_streak)
    values (v_today, p_loser_team_id, 0, 0, 0, 0, 0)
    on conflict (date, team_id) do nothing;

    -- Winner Stats
    select current_streak, points
    into v_winner_streak, v_winner_points
    from public.doubles_daily_stats
    where date = v_today and team_id = p_winner_team_id;

    -- Base Points
    v_winner_streak := v_winner_streak + 1;
    if v_winner_streak = 1 then
        v_base_points := 1.0;
    elseif v_winner_streak = 2 then
        v_base_points := 0.5;
    elseif v_winner_streak = 3 then
        v_base_points := 0.33;
    elseif v_winner_streak = 4 then
        v_base_points := 0.25;
    else
        v_base_points := 0.2;
    end if;

    -- King Bonus
    if v_current_king_team_id = p_loser_team_id then
        select current_streak into v_king_streak
        from public.doubles_daily_stats
        where date = v_today and team_id = p_loser_team_id;
        
        if v_king_streak >= 3 then
            v_king_bonus := 0.5;
        end if;
    end if;

    -- Multiplier
    select (wins + losses) into v_loser_matches_today 
    from public.doubles_daily_stats where date = v_today and team_id = p_loser_team_id;
    
    if v_loser_matches_today = 0 then
        with yesterday_ranking as (
            select team_id, percent_rank() over (order by points desc) as pct
            from public.doubles_daily_stats
            where date = v_yesterday
        )
        select pct into v_daily_percentile from yesterday_ranking where team_id = p_loser_team_id;
        if not found then v_daily_percentile := 0.5; end if;
    else
        with today_ranking as (
            select team_id, percent_rank() over (order by points desc) as pct
            from public.doubles_daily_stats
            where date = v_today
        )
        select pct into v_daily_percentile from today_ranking where team_id = p_loser_team_id;
    end if;
    
    begin
        with global_ranking as (
            select team_id, total_matches, percent_rank() over (order by total_wins desc) as pct
            from public.doubles_total_wins
        )
        select case when total_matches = 0 then 0.5 else pct end into v_global_percentile 
        from global_ranking where team_id = p_loser_team_id;
        if not found then v_global_percentile := 0.5; end if;
    exception when others then
        v_global_percentile := 0.5;
    end;
    
    v_composite_percentile := (v_daily_percentile + v_global_percentile) / 2.0;

    if v_composite_percentile <= 0.3 then
        v_opponent_multiplier := 1.3;
    elseif v_composite_percentile <= 0.7 then
        v_opponent_multiplier := 1.0;
    else
        v_opponent_multiplier := 0.7;
    end if;

    v_final_points := (v_base_points + v_king_bonus) * v_opponent_multiplier;
    
    -- Insert Match
    insert into public.doubles_matches (winner_team_id, loser_team_id, points_awarded, is_king_defense)
    values (p_winner_team_id, p_loser_team_id, v_final_points, (v_current_king_team_id = p_winner_team_id));

    -- Update Stats
    update public.doubles_daily_stats
    set points = points + v_final_points,
        wins = wins + 1,
        current_streak = v_winner_streak,
        max_streak = greatest(max_streak, v_winner_streak)
    where date = v_today and team_id = p_winner_team_id;
    
    update public.doubles_daily_stats
    set losses = losses + 1,
        current_streak = 0
    where date = v_today and team_id = p_loser_team_id;

    return jsonb_build_object(
        'winner_id', p_winner_team_id,
        'points_awarded', v_final_points,
        'base', v_base_points,
        'bonus', v_king_bonus,
        'multiplier', v_opponent_multiplier,
        'composite_percentile', v_composite_percentile
    );
end;
$$ language plpgsql;

-- 8. Función para Cerrar el Día en Parejas
create or replace function public.close_doubles_day_bonus(p_date date DEFAULT current_date)
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
    SELECT EXISTS(SELECT 1 FROM public.closed_days WHERE date = p_date) INTO v_already_closed;
    
    SELECT count(*) INTO v_stats_count FROM public.doubles_daily_stats WHERE date = p_date;
    IF v_stats_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No hay datos de parejas para esta fecha.');
    END IF;

    -- Bonus Racha
    SELECT d.team_id, d.max_streak, t.name INTO v_bonus_winner_id, v_bonus_streak, v_bonus_winner_name
    FROM public.doubles_daily_stats d
    JOIN public.doubles_teams t ON d.team_id = t.id
    WHERE date = p_date
    ORDER BY d.max_streak DESC, d.points DESC
    LIMIT 1;

    IF v_bonus_winner_id IS NOT NULL THEN
        UPDATE public.doubles_daily_stats
        SET points = points + 2
        WHERE date = p_date AND team_id = v_bonus_winner_id;
    END IF;

    -- Ganador del día
    SELECT ds.team_id, t.name, ds.points 
    INTO v_day_winner_id, v_day_winner_name, v_day_winner_points
    FROM public.doubles_daily_stats ds
    JOIN public.doubles_teams t ON ds.team_id = t.id
    WHERE ds.date = p_date
    ORDER BY ds.points DESC, ds.wins DESC, ds.max_streak DESC
    LIMIT 1;

    -- Update Global League Standings
    IF v_day_winner_id IS NOT NULL THEN
        INSERT INTO public.doubles_league_standings (team_id, day_wins, total_points)
        VALUES (v_day_winner_id, 1, v_day_winner_points)
        ON CONFLICT (team_id) 
        DO UPDATE SET 
            day_wins = doubles_league_standings.day_wins + 1,
            total_points = doubles_league_standings.total_points + v_day_winner_points,
            last_updated = now();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bonus_winner', jsonb_build_object('name', v_bonus_winner_name, 'streak', v_bonus_streak),
        'day_winner', jsonb_build_object('name', v_day_winner_name, 'points', v_day_winner_points),
        'message', 'Día cerrado correctamente en Parejas. ¡Victoria para ' || v_day_winner_name || '!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Realtime y RLS
alter table public.doubles_teams enable row level security;
alter table public.doubles_daily_stats enable row level security;
alter table public.doubles_matches enable row level security;
alter table public.doubles_league_standings enable row level security;

drop policy if exists "Allow public read" on public.doubles_teams;
drop policy if exists "Allow public insert" on public.doubles_teams;
create policy "Allow public read" on public.doubles_teams for select using (true);
create policy "Allow public insert" on public.doubles_teams for insert with check (true);

drop policy if exists "Allow public read" on public.doubles_daily_stats;
drop policy if exists "Allow public insert" on public.doubles_daily_stats;
drop policy if exists "Allow public update" on public.doubles_daily_stats;
create policy "Allow public read" on public.doubles_daily_stats for select using (true);
create policy "Allow public insert" on public.doubles_daily_stats for insert with check (true);
create policy "Allow public update" on public.doubles_daily_stats for update using (true);

drop policy if exists "Allow public read" on public.doubles_matches;
drop policy if exists "Allow public insert" on public.doubles_matches;
create policy "Allow public read" on public.doubles_matches for select using (true);
create policy "Allow public insert" on public.doubles_matches for insert with check (true);

drop policy if exists "Allow public read" on public.doubles_league_standings;
create policy "Allow public read" on public.doubles_league_standings for select using (true);

-- Enable Realtime (Ignore if already added)
do $$
begin
    begin
        alter publication supabase_realtime add table public.doubles_teams;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.doubles_daily_stats;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.doubles_matches;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.doubles_league_standings;
    exception when duplicate_object then null;
    end;
end $$;

-- 10. Doubles Cup Mode
alter table public.doubles_matches add column if not exists match_type text default 'regular';
alter table public.doubles_matches add column if not exists cup_phase text;
alter table public.doubles_matches add column if not exists cup_id uuid;

create table if not exists public.doubles_cups (
    id uuid primary key default uuid_generate_v4(),
    name text default 'Matapi''s Cup 2025',
    status text default 'setup', -- setup, groups, finals, finished
    finals_mode text default 'none', -- none, semi_final_final, third_fourth_semi_final, only_final
    created_at timestamptz default now(),
    winner_team_id uuid references public.doubles_teams(id)
);

create table if not exists public.doubles_cup_teams (
    cup_id uuid references public.doubles_cups(id) on delete cascade,
    team_id uuid references public.doubles_teams(id) on delete cascade,
    group_name text,
    primary key (cup_id, team_id)
);

alter table public.doubles_matches drop constraint if exists fk_doubles_matches_cup;
alter table public.doubles_matches add constraint fk_doubles_matches_cup foreign key (cup_id) references public.doubles_cups(id) on delete cascade;

alter table public.doubles_cups enable row level security;
alter table public.doubles_cup_teams enable row level security;

drop policy if exists "Allow public read" on public.doubles_cups;
drop policy if exists "Allow public update" on public.doubles_cups;
drop policy if exists "Allow public insert" on public.doubles_cups;
create policy "Allow public read" on public.doubles_cups for select using (true);
create policy "Allow public update" on public.doubles_cups for update using (true);
create policy "Allow public insert" on public.doubles_cups for insert with check (true);

drop policy if exists "Allow public read" on public.doubles_cup_teams;
drop policy if exists "Allow public delete" on public.doubles_cup_teams;
drop policy if exists "Allow public insert" on public.doubles_cup_teams;
create policy "Allow public read" on public.doubles_cup_teams for select using (true);
create policy "Allow public delete" on public.doubles_cup_teams for delete using (true);
create policy "Allow public insert" on public.doubles_cup_teams for insert with check (true);

do $$
begin
    begin
        alter publication supabase_realtime add table public.doubles_cups;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.doubles_cup_teams;
    exception when duplicate_object then null;
    end;
end $$;

-- 11. Undo Last Doubles Match
CREATE OR REPLACE FUNCTION public.undo_last_doubles_match(p_match_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_match_id uuid;
    v_winner_id uuid;
    v_loser_id uuid;
    v_match_date date;
    v_match_type text;
    v_team_ids uuid[];
    v_tid uuid;
    v_already_closed boolean;
    
    -- Recalculation variables
    v_wins int;
    v_losses int;
    v_points float;
    v_current_streak int;
    v_max_streak int;
    
    v_m record;
BEGIN
    IF p_match_id IS NOT NULL THEN
        SELECT id, winner_team_id, loser_team_id, created_at::date, match_type
        INTO v_match_id, v_winner_id, v_loser_id, v_match_date, v_match_type
        FROM public.doubles_matches
        WHERE id = p_match_id;
    ELSE
        SELECT id, winner_team_id, loser_team_id, created_at::date, match_type
        INTO v_match_id, v_winner_id, v_loser_id, v_match_date, v_match_type
        FROM public.doubles_matches
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_match_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró el partido para eliminar.');
    END IF;

    IF v_match_type = 'regular' THEN
        SELECT EXISTS(SELECT 1 FROM public.closed_days WHERE date = v_match_date) INTO v_already_closed;
        IF v_already_closed THEN
            RETURN jsonb_build_object('success', false, 'message', 'No se puede anular un partido de un día ya cerrado (Fecha: ' || v_match_date || ').');
        END IF;
    END IF;

    DELETE FROM public.doubles_matches WHERE id = v_match_id;

    IF v_match_type = 'regular' THEN
        v_team_ids := ARRAY[v_winner_id, v_loser_id];

        FOREACH v_tid IN ARRAY v_team_ids LOOP
            v_wins := 0;
            v_losses := 0;
            v_points := 0;
            v_current_streak := 0;
            v_max_streak := 0;

            FOR v_m IN (
                SELECT winner_team_id, loser_team_id, points_awarded
                FROM public.doubles_matches
                WHERE (winner_team_id = v_tid OR loser_team_id = v_tid)
                  AND created_at::date = v_match_date
                  AND match_type = 'regular'
                ORDER BY created_at ASC
            ) LOOP
                IF v_m.winner_team_id = v_tid THEN
                    v_wins := v_wins + 1;
                    v_points := v_points + v_m.points_awarded;
                    v_current_streak := v_current_streak + 1;
                    v_max_streak := greatest(v_max_streak, v_current_streak);
                ELSE
                    v_losses := v_losses + 1;
                    v_current_streak := 0;
                END IF;
            END LOOP;

            UPDATE public.doubles_daily_stats
            SET 
                wins = v_wins,
                losses = v_losses,
                points = v_points,
                current_streak = v_current_streak,
                max_streak = v_max_streak
            WHERE date = v_match_date AND team_id = v_tid;
            
            IF (v_wins + v_losses) = 0 THEN
                DELETE FROM public.doubles_daily_stats WHERE date = v_match_date AND team_id = v_tid;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Partido de Parejas anulado correctamente.',
        'match_id', v_match_id,
        'match_type', v_match_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 12. Function to increment cup wins total for a team in league standings (called on Cup Finish)
CREATE OR REPLACE FUNCTION public.increment_doubles_cup_wins(p_team_id uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO public.doubles_league_standings (team_id, day_wins, total_points)
    VALUES (p_team_id, 0, 0)
    ON CONFLICT (team_id) DO NOTHING;
    
    -- Currently we don't have a cup_wins column in doubles_league_standings. Let's add it dynamically.
    -- (This isn't supported inside a block easily in PG without EXECUTE, but since this is run as schema, we can do it outside or just add it to table definition)
    -- UPDATE: We should add it to the table directly.
    UPDATE public.doubles_league_standings
    SET cup_wins = coalesce(cup_wins, 0) + 1, last_updated = now()
    WHERE team_id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
