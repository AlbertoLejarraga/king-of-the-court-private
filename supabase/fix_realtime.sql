-- Enable Realtime for Tables
-- By default, Supabase might not enable replication for all tables.
-- We must explicitly add them to the 'supabase_realtime' publication.

begin;

  -- 1. Enable replication for Daily Stats (Crucial for Dashboard)
  alter table public.daily_stats replica identity full;
  alter publication supabase_realtime add table public.daily_stats;

  -- 2. Enable replication for Matches
  alter table public.matches replica identity full;
  alter publication supabase_realtime add table public.matches;

  -- 3. Enable replication for Closed Days (Triggering Close Day updates)
  alter table public.closed_days replica identity full;
  alter publication supabase_realtime add table public.closed_days;

  -- 4. Enable replication for League Standings (Day Winners Board)
  alter table public.league_standings replica identity full;
  alter publication supabase_realtime add table public.league_standings;

commit;

-- Note: If tables are already in publication, this might throw a warning/error, 
-- but 'alter publication ... add table' is usually idempotent-ish or safe to retry.
-- Ideally run:
-- drop publication if exists supabase_realtime; 
-- create publication supabase_realtime for all tables;
-- BUT that's aggressive. Better to add specific tables.
