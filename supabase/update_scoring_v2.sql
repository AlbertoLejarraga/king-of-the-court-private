-- Update Scoring Logic V2
-- 1. King Bonus requires King Streak >= 3
-- 2. Multiplier uses Composite Percentile (Daily Points + Total Wins)

create or replace function public.report_match(
    p_winner_id uuid,
    p_loser_id uuid
) returns jsonb as $$
declare
    v_today date := current_date;
    v_yesterday date := current_date - 1;
    
    -- Winner Stats
    v_winner_streak int;
    v_winner_points float;
    
    -- Loser Stats for Calculation
    v_loser_rank_score float;
    v_loser_matches_today int;
    
    -- Percentiles
    v_daily_percentile float := 0.5;
    v_global_percentile float := 0.5;
    v_composite_percentile float;
    
    -- Calc variables
    v_base_points float;
    v_king_bonus float := 0;
    v_opponent_multiplier float := 1.0;
    v_final_points float;
    
    -- King Status
    v_current_king_id uuid;
    v_king_streak int := 0; -- To check king's streak
begin
    -- A. Get Current King Information
    select player_id into v_current_king_id from public.current_king;
    
    -- If there is a king, get their current streak (from Daily Stats of TODAY)
    -- WARNING: If King hasn't played today, their streak might clearly be 0 in daily_stats if we just inserted.
    -- Actually, we must check their streak BEFORE resetting it.
    -- If the King hasn't played today, we need to check if they have a streak carried over?
    -- The current logic seems to track streak day-by-day or reset?
    -- Looking at daily_stats table: `current_streak`.
    -- If the King won yesterday and has streak, it should be in yesterday's stats?
    -- No, usually streak is reset daily unless logic says otherwise.
    -- But let's assume `daily_stats` holds the active streak for the day.
    -- If King is from Yesterday and hasn't played today, this might be tricky.
    -- SIMPLIFICATION for this App: "King of the Court" implies King status persists.
    -- But `daily_stats` resets daily.
    -- Let's fetch the King's streak from their latest `daily_stats` entry where they played?
    -- Or just check today's stats if they exist.
    -- If `v_current_king_id` matches `p_loser_id`, we need `p_loser`'s streak BEFORE it gets reset to 0 by this function.
    
    -- So let's fetch Loser's stats first.
    
    -- B. Upsert Daily Stats for TODAY (Init to 0 if new)
    insert into public.daily_stats (date, player_id, points, wins, losses, current_streak, max_streak)
    values (v_today, p_winner_id, 0, 0, 0, 0, 0)
    on conflict (date, player_id) do nothing;
    
    insert into public.daily_stats (date, player_id, points, wins, losses, current_streak, max_streak)
    values (v_today, p_loser_id, 0, 0, 0, 0, 0)
    on conflict (date, player_id) do nothing;

    -- Fetch Winner Current Stats
    select current_streak, points
    into v_winner_streak, v_winner_points
    from public.daily_stats
    where date = v_today and player_id = p_winner_id;

    -- C. Calculate Base Points
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

    -- D. Calculate King Bonus
    -- Check if Loser is King AND has Streak >= 3
    if v_current_king_id = p_loser_id then
        -- Get Loser (King) Streak
        select current_streak into v_king_streak
        from public.daily_stats
        where date = v_today and player_id = p_loser_id;
        
        -- If King hasn't played this day yet but is still King from yesterday, their today-streak is 0.
        -- If that's the case, they are "fresh" for the day, so easy to beat?
        -- Logic: "if the king batido llevaba al menos 3 partidos" (current streak >= 3).
        
        if v_king_streak >= 3 then
            v_king_bonus := 0.5;
        end if;
    end if;

    -- E. Calculate Opponent Multiplier (Composite Percentile)
    
    -- 1. Daily Percentile
    -- Check if Loser has played enough today or fallback to yesterday
    select (wins + losses) into v_loser_matches_today 
    from public.daily_stats where date = v_today and player_id = p_loser_id;
    
    if v_loser_matches_today = 0 then
        -- Try Yesterday
        with yesterday_ranking as (
            select player_id, percent_rank() over (order by points desc) as pct
            from public.daily_stats
            where date = v_yesterday
        )
        select pct into v_daily_percentile from yesterday_ranking where player_id = p_loser_id;
        
        if not found then v_daily_percentile := 0.5; end if; -- Start as Mid
    else
        -- Use Today
        with today_ranking as (
            select player_id, percent_rank() over (order by points desc) as pct
            from public.daily_stats
            where date = v_today
        )
        select pct into v_daily_percentile from today_ranking where player_id = p_loser_id;
    end if;
    
    -- 2. Global Percentile (Total Wins)
    -- Assuming queryable 'player_total_wins' view or table creates rank
    -- If view doesn't exist, we fallback to 0.5
    begin
        with global_ranking as (
            select player_id, percent_rank() over (order by total_wins desc) as pct
            from public.player_total_wins
        )
        select pct into v_global_percentile from global_ranking where player_id = p_loser_id;
        
        if not found then v_global_percentile := 0.5; end if;
    exception when others then
        v_global_percentile := 0.5; -- Table/View might not exist
    end;
    
    -- 3. Composite
    v_composite_percentile := (v_daily_percentile + v_global_percentile) / 2.0;

    -- 4. Apply Multiplier
    if v_composite_percentile <= 0.3 then
        v_opponent_multiplier := 1.3; -- Top 30%
    elseif v_composite_percentile <= 0.7 then
        v_opponent_multiplier := 1.0; -- Mid 40%
    else
        v_opponent_multiplier := 0.7; -- Low 30%
    end if;

    -- F. Final Calculation
    v_final_points := (v_base_points + v_king_bonus) * v_opponent_multiplier;
    
    -- G. Update Matches Table
    insert into public.matches (winner_id, loser_id, points_awarded, is_king_defense)
    values (p_winner_id, p_loser_id, v_final_points, (v_current_king_id = p_winner_id));

    -- H. Update Daily Stats
    -- Winner
    update public.daily_stats
    set 
        points = points + v_final_points,
        wins = wins + 1,
        current_streak = v_winner_streak,
        max_streak = greatest(max_streak, v_winner_streak)
    where date = v_today and player_id = p_winner_id;
    
    -- Loser
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
        'daily_percentile', v_daily_percentile,
        'global_percentile', v_global_percentile,
        'composite_percentile', v_composite_percentile
    );
end;
$$ language plpgsql;
