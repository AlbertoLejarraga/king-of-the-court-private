-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Players Table
create table public.players (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    avatar_url text,
    created_at timestamptz default now()
);

-- 2. Daily Stats (Materialized Daily Ranking)
create table public.daily_stats (
    date date not null default current_date,
    player_id uuid references public.players(id) on delete cascade,
    points float default 0,
    wins int default 0,
    losses int default 0,
    current_streak int default 0,
    max_streak int default 0,
    rank int, -- Cached rank for the day
    created_at timestamptz default now(),
    primary key (date, player_id)
);

-- 3. Matches Table
create table public.matches (
    id uuid primary key default uuid_generate_v4(),
    winner_id uuid references public.players(id),
    loser_id uuid references public.players(id),
    is_king_defense boolean default false,
    points_awarded float not null,
    created_at timestamptz default now()
);

-- Indexes for performance
create index idx_daily_stats_date_points on public.daily_stats(date, points desc);
create index idx_matches_winner on public.matches(winner_id);
create index idx_matches_loser on public.matches(loser_id);
create index idx_matches_created_at on public.matches(created_at);

-- 4. King tracking (We can query the latest match, but a helper view/table is faster)
-- We will just query the last match to find the current king.
create or replace view public.current_king as
select winner_id as player_id
from public.matches
order by created_at desc
limit 1;


-- 5. FUNCTION: Report Match (Core Logic)
create or replace function public.report_match(
    p_winner_id uuid,
    p_loser_id uuid
) returns jsonb as $$
declare
    v_today date := current_date;
    v_yesterday date := current_date - 1;
    
    -- Winner Stats
    v_winner_streak int;
    v_winner_max_streak int;
    v_winner_points float;
    
    -- Loser Stats
    v_loser_rank_score float; -- Normalized score for ranking purposes
    v_total_players int;
    v_loser_percentile float;
    
    -- Calc variables
    v_base_points float;
    v_king_bonus float := 0;
    v_opponent_multiplier float := 1.0;
    v_final_points float;
    
    -- King Status
    v_current_king_id uuid;
begin
    -- A. Get Current King (before inserting this match)
    select player_id into v_current_king_id from public.current_king;
    
    -- B. Upsert Daily Stats for TODAY for both players
    -- Winner
    insert into public.daily_stats (date, player_id, points, wins, losses, current_streak, max_streak)
    values (v_today, p_winner_id, 0, 0, 0, 0, 0)
    on conflict (date, player_id) do nothing;
    
    -- Loser
    insert into public.daily_stats (date, player_id, points, wins, losses, current_streak, max_streak)
    values (v_today, p_loser_id, 0, 0, 0, 0, 0)
    on conflict (date, player_id) do nothing;

    -- Fetch current stats for Winner
    select current_streak, max_streak, points
    into v_winner_streak, v_winner_max_streak, v_winner_points
    from public.daily_stats
    where date = v_today and player_id = p_winner_id;

    -- C. Calculate Base Points (based on UPDATED streak, so streak+1)
    -- Streak logic: 1st win (streak 0->1) = 1pt. 
    -- If current_streak is 0, this is 1st win.
    -- If current_streak is 1, this is 2nd win.
    v_winner_streak := v_winner_streak + 1; -- Increment for this match
    
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

    -- D. Calculate King Bonus
    -- If the loser was the King, the winner (challenger) gets +0.5
    -- Make sure the winner wasn't already the king (defending)
    if v_current_king_id = p_loser_id then
        v_king_bonus := 0.5;
    end if;

    -- E. Calculate Opponent Multiplier
    -- We need to rank the loser relative to the field.
    -- Priority: Today's Rank -> Yesterday's Rank -> First Day Default (MID)
    
    -- Count total players active (today or yesterday to be safe? Let's check today first)
    select count(*) into v_total_players from public.daily_stats where date = v_today;
    
    -- If very few players today (start of day), maybe check yesterday?
    -- Requirement: "if current daily classification is starting, the previous day classification will be taken into account"
    -- Let's define "starting" as < 4 players? Or just calculate rank based on what we have.
    -- Actually, simpler: Get the loser's ranking from a combined view or just today.
    -- Let's try to get yesterday's stats if today's stats are empty for others.
    
    -- Logic: Calculate Loser's Percentile.
    -- We need the loser's "Skill Score" to rank them. Use Points.
    
    -- If it's the first match of the day for the loser, their points are 0.
    -- So we should look at Yesterday's points for the multiplier if today is fresh.
    -- But if they have played today, use today.
    -- Let's verify "if current daily classification is starting".
    -- We will check if the loser has ANY matches today.
    -- Actually, we just inserted them. So wins+losses of loser.
    
    declare
        v_loser_matches_today int;
        v_loser_yesterday_points float;
        v_player_rank int;
        v_total_ranked int;
    begin
        select (wins + losses) into v_loser_matches_today 
        from public.daily_stats where date = v_today and player_id = p_loser_id;
        
        -- If loser hasn't played much today (e.g. 0 matches before this), use yesterday's standing
        if v_loser_matches_today = 0 then
            -- Use Yesterday
             -- Get all players from yesterday ordered by points
            with yesterday_ranking as (
                select player_id, percent_rank() over (order by points desc) as pct
                from public.daily_stats
                where date = v_yesterday
            )
            select pct into v_loser_percentile from yesterday_ranking where player_id = p_loser_id;
            
            if not found then
                v_loser_percentile := 0.5; -- Default to MID if no history
            end if;
        else
            -- Use Today
            with today_ranking as (
                select player_id, percent_rank() over (order by points desc) as pct
                from public.daily_stats
                where date = v_today
            )
            select pct into v_loser_percentile from today_ranking where player_id = p_loser_id;
        end if;
    end;

    -- Multiplier Logic (Top 30%, Mid 40%, Low 30%)
    -- percent_rank 0 is top (highest points), 1 is bottom.
    -- Wait, percent_rank returns 0 to 1. 
    -- ORDER BY points DESC:
    -- Rank 1 (Top) -> pct close to 0.0
    -- Rank Last -> pct close to 1.0
    -- Top 30% means pct <= 0.3
    -- Mid 40% means 0.3 < pct <= 0.7
    -- Low 30% means pct > 0.7
    
    if v_loser_percentile <= 0.3 then
        v_opponent_multiplier := 1.3; -- TOP
    elseif v_loser_percentile <= 0.7 then
        v_opponent_multiplier := 1.0; -- MID
    else
        v_opponent_multiplier := 0.7; -- LOW
    end if;

    -- F. Final Calculation
    v_final_points := (v_base_points + v_king_bonus) * v_opponent_multiplier;
    
    -- G. Update Matches Table
    insert into public.matches (winner_id, loser_id, points_awarded, is_king_defense)
    values (p_winner_id, p_loser_id, v_final_points, (v_current_king_id = p_winner_id));

    -- H. Update Daily Stats
    -- Update Winner
    update public.daily_stats
    set 
        points = points + v_final_points,
        wins = wins + 1,
        current_streak = v_winner_streak,
        max_streak = greatest(max_streak, v_winner_streak)
    where date = v_today and player_id = p_winner_id;
    
    -- Update Loser
    update public.daily_stats
    set 
        losses = losses + 1,
        current_streak = 0
    where date = v_today and player_id = p_loser_id;

    return jsonb_build_object(
        'winner_id', p_winner_id,
        'points_awarded', v_final_points,
        'base', v_base_points,
        'bonus', v_king_bonus,
        'multiplier', v_opponent_multiplier,
        'loser_percentile', v_loser_percentile
    );
end;
$$ language plpgsql;

-- 6. RLS Policies (Security)
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.daily_stats enable row level security;

-- For this project, we prioritize Simplicity. Allow All for now/Authenticated.
-- Ideally, we would restrict "Report Match" to authenticated users, but user asked for "Simple".
-- We will assume the API Key handles the "Auth".

create policy "Allow public read" on public.players for select using (true);
create policy "Allow public insert" on public.players for insert with check (true);

create policy "Allow public read" on public.matches for select using (true);
create policy "Allow public insert" on public.matches for insert with check (true);

create policy "Allow public read" on public.daily_stats for select using (true);
-- Stats are updated by the function, which bypasses RLS if defined as SECURITY DEFINER,
-- but for now let's allow updates just in case the client needs to read.
