import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { TrendingUp, Target, Skull, Heart, Handshake, Zap, Calendar, ArrowUpRight, ArrowDownRight, ArrowLeft, LayoutDashboard, Trophy, Dices, User } from 'lucide-react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import Escudo from '../assets/Escudo_UDSanse.png'

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
        <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
            {/* Header */}
            <div className="relative flex justify-between items-center p-6 md:p-8 shrink-0">
                <div className="flex items-center gap-4 md:gap-8 z-10">
                    <Link to="/" className="bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 p-3 rounded-full border border-neutral-700 transition-all">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="bg-gradient-to-b from-blue-400 to-indigo-600 h-16 w-3 rounded-full shadow-[0_0_20px_blue]"></div>
                    <div>
                        <h1 className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 uppercase">
                            Estadísticas
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3 md:gap-6 z-10">
                    <img src={Escudo} alt="Escudo UD Sanse" className="h-16 md:h-24 w-auto object-contain opacity-80" />
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full pb-32 md:pb-8">
                <div className="bg-neutral-900/50 rounded-[3rem] border border-neutral-800 p-6 md:p-8 shadow-2xl">
                    <select
                        className="w-full bg-neutral-800 border-2 border-neutral-700 rounded-2xl p-4 text-xl mb-8 outline-none focus:border-blue-500 transition-colors"
                        style={{ colorScheme: 'dark' }}
                        value={selectedPlayerId}
                        onChange={e => setSelectedPlayerId(e.target.value)}
                    >
                        <option value="">Selecciona un jugador...</option>
                        {players.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {selectedPlayerId && advancedStats ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

                            {/* Curiosidades Section */}
                            <div>
                                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Zap size={16} /> Curiosidades
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Favorite Rival */}
                                    <div className="bg-neutral-800/80 p-5 rounded-3xl border border-neutral-700 flex justify-between items-center group hover:bg-neutral-800 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-pink-500/20 p-3 rounded-2xl text-pink-500 group-hover:scale-110 transition-transform">
                                                <Heart size={24} fill="currentColor" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Rival Favorito</div>
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
                                    <div className="bg-neutral-800/80 p-5 rounded-3xl border border-neutral-700 flex justify-between items-center group hover:bg-neutral-800 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-red-500/20 p-3 rounded-2xl text-red-500 group-hover:scale-110 transition-transform">
                                                <Skull size={24} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Criptonita</div>
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
                                    <div className="bg-neutral-800/80 p-5 rounded-3xl border border-neutral-700 flex justify-between items-center group hover:bg-neutral-800 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-500/20 p-3 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                                                <Handshake size={24} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Más Jugado</div>
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
                            </div>

                            {/* Summary Cards Grid */}
                            <div>
                                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 mt-8 flex items-center gap-2">
                                    <LayoutDashboard size={16} /> Resumen Global
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Win Rate */}
                                    <div className="bg-neutral-800 p-5 rounded-3xl border border-neutral-700 relative overflow-hidden">
                                        <div className="text-neutral-500 text-[10px] uppercase font-black tracking-wider flex items-center gap-2 mb-2">
                                            <TrendingUp size={14} className="text-green-500" /> Victoria %
                                        </div>
                                        <div className="text-4xl font-black">{advancedStats.win_rate}%</div>
                                    </div>
                                    {/* Total Matches */}
                                    <div className="bg-neutral-800 p-5 rounded-3xl border border-neutral-700">
                                        <div className="text-neutral-500 text-[10px] uppercase font-black tracking-wider flex items-center gap-2 mb-2">
                                            <Target size={14} className="text-blue-500" /> Partidos
                                        </div>
                                        <div className="text-4xl font-black">{advancedStats.total_matches}</div>
                                    </div>
                                    {/* Max Streak */}
                                    <div className="col-span-2 bg-gradient-to-r from-yellow-900/20 to-neutral-800 p-5 rounded-3xl border border-yellow-500/20 flex flex-col justify-center">
                                        <div className="text-yellow-500 text-[10px] uppercase font-black tracking-wider flex items-center gap-2 mb-2">
                                            <Zap size={14} fill="currentColor" /> Racha Más Larga
                                        </div>
                                        <div className="text-4xl font-black text-white">{advancedStats.max_streak} <span className="text-lg font-bold text-neutral-500">victorias</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Matches List */}
                            <div>
                                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 mt-8 flex items-center gap-2">
                                    <Calendar size={16} /> Historial Reciente
                                </h3>
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
                                                        <div className={clsx("font-black text-[10px] uppercase px-2 py-1 rounded-lg tracking-wider", isWinner ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                                            {isWinner ? 'Victoria' : 'Derrota'}
                                                        </div>
                                                        <span className="text-neutral-500 text-xs font-bold flex items-center gap-1">
                                                            <Calendar size={10} /> {dateStr}
                                                        </span>
                                                    </div>
                                                    <div className="text-white font-bold text-lg flex items-center gap-2">
                                                        {isWinner ? <ArrowUpRight size={18} className="text-green-500" /> : <ArrowDownRight size={18} className="text-red-500" />}
                                                        <span>vs <span className="text-neutral-200">{opponentName}</span></span>
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
                                        <div className="text-neutral-500 text-center py-12 italic border border-dashed border-neutral-800 rounded-3xl">Sin partidos registrados.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-neutral-500 text-center py-20 italic">
                            <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-700">
                                <User size={40} />
                            </div>
                            <p className="text-lg">Selecciona un jugador para ver sus estadísticas.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Navigation - Same as Dashboard but with Histórico active */}
            <div className="md:hidden fixed bottom-0 left-0 w-full bg-neutral-900/90 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-between items-center z-[80] shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <Link
                    to="/"
                    className="flex flex-col items-center gap-1 text-neutral-500 active:text-white transition-colors"
                >
                    <LayoutDashboard size={28} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Ranking</span>
                </Link>

                <Link
                    to="/" // User can switch mode in Dashboard
                    className="flex flex-col items-center gap-1 text-neutral-500 active:text-white transition-colors"
                >
                    <Trophy size={28} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Copa</span>
                </Link>

                <Link
                    to="/" // User can open roulette in Dashboard
                    className="flex flex-col items-center gap-1 text-neutral-500 active:text-white transition-colors"
                >
                    <Dices size={28} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Ruleta</span>
                </Link>

                <button
                    disabled
                    className="flex flex-col items-center gap-1 text-blue-500 scale-110 cursor-default"
                >
                    <User size={28} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Historico</span>
                </button>
            </div>
        </div>
    )
}
