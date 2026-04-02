export interface Player {
    id: string
    name: string
    avatar_url?: string
    created_at: string
}

export interface DailyStat {
    date: string
    player_id: string
    points: number
    wins: number
    losses: number
    current_streak: number
    max_streak: number
    rank?: number
    player?: Player // Join
}

export interface MatchResult {
    winner_id: string
    points_awarded: number
    base: number
    bonus: number
    multiplier: number
    loser_percentile: number
}

// -- Doubles Mode Types --

export interface DoublesTeam {
    id: string
    name: string
    player1_id: string
    player2_id: string
    created_at: string
}

export interface DoublesDailyStat {
    date: string
    team_id: string
    points: number
    wins: number
    losses: number
    current_streak: number
    max_streak: number
    rank?: number
    team?: DoublesTeam // Join
}

export interface DoublesLeagueStanding {
    team_id: string
    day_wins: number
    total_points: number
    team?: DoublesTeam
}

export interface DoublesTotalWinRank {
    team_id: string
    name: string
    total_wins: number
    win_percentage: number
    p1_name: string
    p2_name: string
    p1_win_pct: number
    p2_win_pct: number
    p1_wr: number
    p2_wr: number
    team_avg_win_pct: number
}

export interface LeagueStanding {
    player_id: string
    day_wins: number
    cup_wins: number
    total_points: number
    player?: Player
}

export interface Cup {
    id: string
    name: string
    status: 'setup' | 'groups' | 'finals' | 'finished'
    finals_mode: 'none' | 'semi_final_final' | 'third_fourth_semi_final' | 'only_final'
    winner_id?: string
}

export interface CupPlayer {
    cup_id: string
    player_id: string
    group_name: 'A' | 'B' | 'C' | null
    player?: Player
}
