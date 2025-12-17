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
