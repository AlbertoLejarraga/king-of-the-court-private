import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import clsx from 'clsx'
import type { DoublesLeagueStanding, DoublesTotalWinRank } from '../types'

export function DoublesDayWinnersBoard() {
    const [dayWinners, setDayWinners] = useState<DoublesLeagueStanding[]>([])

    useEffect(() => {
        fetchGlobal()
        const sub = supabase.channel('doubles_day_winners_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doubles_league_standings' }, fetchGlobal)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    async function fetchGlobal() {
        const { data } = await supabase
            .from('doubles_league_standings')
            .select('team_id, day_wins, total_points, team:doubles_teams(name)')
            .order('day_wins', { ascending: false })
        if (data) setDayWinners(data as any)
    }

    return (
        <div className="bg-gradient-to-br from-blue-900/40 to-neutral-900/80 rounded-[2.5rem] p-6 border border-blue-500/20 shadow-xl overflow-hidden flex flex-col h-full relative group">
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <h3 className="text-xl font-black text-blue-500 mb-4 flex items-center gap-3 uppercase tracking-wide border-b border-blue-500/20 pb-3">
                <span className="text-2xl">🏆</span> Reyes del Día (Parejas)
            </h3>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                {dayWinners.length === 0 && <p className="text-neutral-500 text-lg italic text-center mt-10">Sin datos.</p>}
                {dayWinners.map((r, i) => (
                    <div key={r.team_id} className="flex justify-between items-center p-3 rounded-2xl bg-neutral-800/50 border border-neutral-700/50">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className={clsx("font-mono font-bold text-lg bg-neutral-700 w-8 h-8 flex items-center justify-center rounded-full text-white shrink-0", i === 0 && "bg-blue-500 text-black")}>
                                {i + 1}
                            </span>
                            <span className={clsx("font-bold text-xl truncate", i === 0 ? "text-blue-100" : "text-neutral-300")}>{r.team?.name?.replace(' & ', ' ♥ ')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-black text-2xl text-blue-500">{r.day_wins}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function DoublesTotalWinsBoard() {
    const [matchWinners, setMatchWinners] = useState<DoublesTotalWinRank[]>([])

    useEffect(() => {
        fetchTotalWins()
        const sub = supabase.channel('doubles_total_wins_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'doubles_matches' }, fetchTotalWins)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    async function fetchTotalWins() {
        const { data } = await supabase.from('doubles_total_wins').select('*').order('total_wins', { ascending: false }).limit(10)
        if (data) setMatchWinners(data as DoublesTotalWinRank[])
    }

    return (
        <div className="bg-neutral-900/80 rounded-[2.5rem] p-6 border border-neutral-800 shadow-xl overflow-hidden flex flex-col h-full">
            <h3 className="text-xl font-black text-neutral-400 mb-4 flex items-center gap-3 uppercase tracking-wide border-b border-neutral-800 pb-3">
                <span className="text-2xl">📊</span> Victorias Totales (Parejas)
            </h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                {matchWinners.map((p, i) => (
                    <div key={p.team_id} className="flex justify-between items-center p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-3">
                                <span className="text-neutral-600 font-mono w-6 text-right text-xl">{i + 1}.</span>
                                <span className="text-neutral-300 font-bold truncate text-lg pb-1">{p.name.replace(' & ', ' ♥ ')}</span>
                            </div>
                            <div className="flex items-center gap-2 pl-12 -mt-1 text-[10px] md:text-sm text-neutral-500 font-mono truncate">
                                <span title={`Histórico Individual: ${p.p1_name}`}>({p.p2_win_pct}%)</span>
                                <span>•</span>
                                <span title={`Histórico Individual: ${p.p2_name}`}>({p.p1_win_pct}%)</span>
                                <span className="ml-2 text-blue-400 font-bold" title="Media del Equipo">AVG: {p.team_avg_win_pct}%</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-white font-bold text-xl">{p.total_wins}</span>
                            <span className="text-neutral-500 font-mono text-sm bg-neutral-800 px-2 py-0.5 rounded-md min-w-[3.5rem] text-center" title="Winrate del Equipo (Partidos Jugados Juntos)">
                                {p.win_percentage}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
