import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { TrendingUp, Target, Skull, Heart, Handshake, Zap, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import clsx from 'clsx'

// Extended interface for local use
interface Match {
    match_id: string
    created_at: string
    winner_id: string
    loser_id: string
    winner_name: string
    loser_name: string
    points_awarded: number
}

interface AdvancedStats {
    total_matches: number
    win_rate: number
    max_streak: number
    favorite_rival: { name: string, count: number } | null
    nemesis: { name: string, count: number } | null
    frequent_rival: { name: string, count: number } | null
}

export default function PlayerStats() {
    const [players, setPlayers] = useState<any[]>([])
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
    const [matches, setMatches] = useState<Match[]>([])
    const [advancedStats, setAdvancedStats] = useState<AdvancedStats | null>(null)

    useEffect(() => {
        supabase.from('players').select('*').order('name').then(({ data }) => {
            if (data) setPlayers(data)
        })
    }, [])

    useEffect(() => {
        if (selectedPlayerId) {
            fetchMatches(selectedPlayerId)
            fetchAdvancedStats(selectedPlayerId)
        } else {
            setAdvancedStats(null)
            setMatches([])
        }
    }, [selectedPlayerId])

    async function fetchMatches(playerId: string) {
        const { data } = await supabase.rpc('get_player_matches', { target_player_id: playerId, limit_count: 20 })
        if (data) setMatches(data as Match[])
    }

    async function fetchAdvancedStats(playerId: string) {
        const { data, error } = await supabase.rpc('get_player_advanced_stats', { target_player_id: playerId })
        if (data) setAdvancedStats(data as AdvancedStats)
        if (error) console.error(error)
    }

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto min-h-screen text-white pb-24">
            <h1 className="text-3xl font-bold mb-6">Estadísticas</h1>

            <select
                className="w-full bg-neutral-800 border-2 border-neutral-700 rounded-xl p-4 text-xl mb-8 outline-none focus:border-yellow-400"
                style={{ colorScheme: 'dark' }}
                value={selectedPlayerId}
                onChange={e => setSelectedPlayerId(e.target.value)}
            >
                <option value="">Selecciona un jugador...</option>
                {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>

            {selectedPlayerId && advancedStats && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

                    <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mt-6 mb-2">Curiosidades</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {/* Favorite Rival */}
                        <div className="bg-neutral-800/80 p-4 rounded-2xl border border-neutral-700 flex justify-between items-center group hover:bg-neutral-800 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="bg-pink-500/20 p-3 rounded-full text-pink-500 group-hover:scale-110 transition-transform">
                                    <Heart size={24} fill="currentColor" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-neutral-400 uppercase">Rival Favorito</div>
                                    <div className="text-xl font-bold text-white leading-none mt-1">
                                        {advancedStats.favorite_rival?.name || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-white">{advancedStats.favorite_rival?.count || 0}</div>
                                <div className="text-[10px] font-bold text-neutral-500 uppercase">Victorias</div>
                            </div>
                        </div>

                        {/* Nemesis */}
                        <div className="bg-neutral-800/80 p-4 rounded-2xl border border-neutral-700 flex justify-between items-center group hover:bg-neutral-800 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="bg-red-500/20 p-3 rounded-full text-red-500 group-hover:scale-110 transition-transform">
                                    <Skull size={24} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-neutral-400 uppercase">Criptonita</div>
                                    <div className="text-xl font-bold text-white leading-none mt-1">
                                        {advancedStats.nemesis?.name || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-red-500">{advancedStats.nemesis?.count || 0}</div>
                                <div className="text-[10px] font-bold text-neutral-500 uppercase">Derrotas</div>
                            </div>
                        </div>

                        {/* Frequent Rival */}
                        <div className="bg-neutral-800/80 p-4 rounded-2xl border border-neutral-700 flex justify-between items-center group hover:bg-neutral-800 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-500/20 p-3 rounded-full text-blue-500 group-hover:scale-110 transition-transform">
                                    <Handshake size={24} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-neutral-400 uppercase">Más Jugado</div>
                                    <div className="text-xl font-bold text-white leading-none mt-1">
                                        {advancedStats.frequent_rival?.name || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-white">{advancedStats.frequent_rival?.count || 0}</div>
                                <div className="text-[10px] font-bold text-neutral-500 uppercase">Partidos</div>
                            </div>
                        </div>
                    </div>

                    {/* Summary Cards Grid */}
                    <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mt-8 mb-2">Resumen Diario</h3>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        {/* Win Rate */}
                        <div className="bg-neutral-800 p-4 rounded-2xl border border-neutral-700">
                            <div className="text-neutral-400 text-xs uppercase font-bold flex items-center gap-2 mb-2">
                                <TrendingUp size={16} className="text-green-500" /> Victoria %
                            </div>
                            <div className="text-3xl font-black">{advancedStats.win_rate}%</div>
                        </div>
                        {/* Total Matches */}
                        <div className="bg-neutral-800 p-4 rounded-2xl border border-neutral-700">
                            <div className="text-neutral-400 text-xs uppercase font-bold flex items-center gap-2 mb-2">
                                <Target size={16} className="text-blue-500" /> Partidos
                            </div>
                            <div className="text-3xl font-black">{advancedStats.total_matches}</div>
                        </div>
                        {/* Max Streak */}
                        <div className="col-span-2 bg-gradient-to-r from-yellow-900/20 to-neutral-800 p-4 rounded-2xl border border-yellow-500/20">
                            <div className="text-yellow-500 text-xs uppercase font-bold flex items-center gap-2 mb-2">
                                <Zap size={16} fill="currentColor" /> Racha Más Larga
                            </div>
                            <div className="text-3xl font-black text-white">{advancedStats.max_streak} <span className="text-lg font-normal text-neutral-400">victorias</span></div>
                        </div>
                    </div>



                    {/* Matches List */}
                    <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mt-8 mb-2">Últimos Partidos</h3>
                    <div className="space-y-3">
                        {matches.map(match => {
                            const isWinner = match.winner_id === selectedPlayerId
                            const opponentName = isWinner ? match.loser_name : match.winner_name

                            // Format Date (DD/MM HH:MM)
                            const date = new Date(match.created_at)
                            const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
                            const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

                            return (
                                <div key={match.match_id} className={clsx("p-4 rounded-2xl flex justify-between items-center border transition-all", isWinner ? "bg-green-500/5 border-green-500/20 hover:bg-green-500/10" : "bg-red-500/5 border-red-500/20 hover:bg-red-500/10")}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={clsx("font-black text-xs uppercase px-2 py-0.5 rounded-lg", isWinner ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                                {isWinner ? 'Victoria' : 'Derrota'}
                                            </div>
                                            <span className="text-neutral-500 text-xs font-bold flex items-center gap-1">
                                                <Calendar size={10} /> {dateStr}
                                            </span>
                                        </div>
                                        <div className="text-white font-bold text-lg flex items-center gap-2">
                                            {isWinner ? <ArrowUpRight size={18} className="text-green-500" /> : <ArrowDownRight size={18} className="text-red-500" />}
                                            vs {opponentName}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {/* Show points only if available and non-zero (assuming points_awarded) */}
                                        {match.points_awarded > 0 && (
                                            <div className="font-bold text-lg tabular-nums text-neutral-300">
                                                +{match.points_awarded.toFixed(1)} <span className="text-[10px] text-neutral-500 uppercase">pts</span>
                                            </div>
                                        )}
                                        <div className="text-xs text-neutral-500 font-bold mt-1">{timeStr}</div>
                                    </div>
                                </div>
                            )
                        })}
                        {matches.length === 0 && (
                            <div className="text-neutral-500 text-center py-8 italic">Sin partidos registrados.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
