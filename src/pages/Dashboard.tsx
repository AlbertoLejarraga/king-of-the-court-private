import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { DailyStat } from '../types'
import { Crown, Flame, Trophy, Gauge, User, X } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import MatchReporter from './MatchReporter'
import QRCode from "react-qr-code";
import { Link } from 'react-router-dom'
import Escudo from '../assets/Escudo_UDSanse.png'

// --- Types ---
interface GlobalRank {
    player_id: string
    day_wins: number
    player: { name: string }
}
interface TotalWinRank {
    player_id: string
    name: string
    total_wins: number
}

// --- Components ---

function DayWinnersBoard() {
    const [dayWinners, setDayWinners] = useState<GlobalRank[]>([])

    useEffect(() => {
        fetchGlobal()
        const sub = supabase.channel('day_winners_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'league_standings' }, fetchGlobal)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    async function fetchGlobal() {
        const { data } = await supabase
            .from('league_standings')
            .select('player_id, day_wins, player:players(name)')
            .order('day_wins', { ascending: false })
        if (data) setDayWinners(data as any)
    }

    return (
        <div className="bg-gradient-to-br from-yellow-900/40 to-neutral-900/80 rounded-[2.5rem] p-6 border border-yellow-500/20 shadow-xl overflow-hidden flex flex-col h-full relative group">
            <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            <h3 className="text-xl font-black text-yellow-500 mb-4 flex items-center gap-3 uppercase tracking-wide border-b border-yellow-500/20 pb-3">
                <Trophy size={28} /> Reyes del Día
            </h3>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                {dayWinners.length === 0 && <p className="text-neutral-500 text-lg italic text-center mt-10">Sin datos.</p>}
                {dayWinners.map((r, i) => (
                    <div key={r.player_id} className="flex justify-between items-center p-3 rounded-2xl bg-neutral-800/50 border border-neutral-700/50">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className={clsx("font-mono font-bold text-lg bg-neutral-700 w-8 h-8 flex items-center justify-center rounded-full text-white shrink-0", i === 0 && "bg-yellow-500 text-black")}>
                                {i + 1}
                            </span>
                            <span className={clsx("font-bold text-xl truncate", i === 0 ? "text-yellow-100" : "text-neutral-300")}>{r.player?.name}</span>
                        </div>
                        <span className="font-black text-2xl text-yellow-500 ml-2">{r.day_wins}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function TotalWinsBoard() {
    const [matchWinners, setMatchWinners] = useState<TotalWinRank[]>([])

    useEffect(() => {
        fetchTotalWins()
        const sub = supabase.channel('total_wins_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, fetchTotalWins)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    async function fetchTotalWins() {
        const { data } = await supabase.from('player_total_wins').select('*').order('total_wins', { ascending: false }).limit(10)
        if (data) setMatchWinners(data)
    }

    return (
        <div className="bg-neutral-900/80 rounded-[2.5rem] p-6 border border-neutral-800 shadow-xl overflow-hidden flex flex-col h-full">
            <h3 className="text-xl font-black text-neutral-400 mb-4 flex items-center gap-3 uppercase tracking-wide border-b border-neutral-800 pb-3">
                <Gauge size={28} /> Victorias Totales
            </h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                {matchWinners.map((p, i) => (
                    <div key={p.player_id} className="flex justify-between items-center text-lg p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-neutral-600 font-mono w-6 text-right text-xl">{i + 1}.</span>
                            <span className="text-neutral-300 font-bold truncate text-xl">{p.name}</span>
                        </div>
                        <span className="text-white font-bold ml-2 text-xl">{p.total_wins}</span>
                    </div>
                ))}
            </div>
        </div>
    )

}

function DayResultModal({ result, onClose }: { result: { bonusWinner: { name: string, streak: number }, dayWinner: { name: string, points: number } } | null, onClose: () => void }) {
    if (!result) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                ></motion.div>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-gradient-to-b from-neutral-800 to-neutral-900 border border-yellow-500/30 w-full max-w-lg rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(234,179,8,0.2)] overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500"></div>
                    <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors bg-neutral-800/50 p-2 rounded-full">
                        <X size={24} />
                    </button>

                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Resultados del Día</h2>
                        <div className="h-1 w-20 bg-yellow-500 mx-auto rounded-full"></div>
                    </div>

                    <div className="space-y-6">
                        {/* Day Winner */}
                        <div className="bg-gradient-to-br from-yellow-900/40 to-black/40 p-6 rounded-3xl border border-yellow-500/30 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex flex-col items-center text-center">
                                <Crown size={48} className="text-yellow-500 mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                                <div className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-1">Ganador del Día</div>
                                <div className="text-4xl font-black text-white tracking-tight mb-2">{result.dayWinner.name}</div>
                                <div className="text-2xl font-bold text-yellow-100/80 table-nums">{result.dayWinner.points.toFixed(2)} pts</div>
                            </div>
                        </div>

                        {/* Racha Bonus */}
                        <div className="bg-neutral-800/50 p-5 rounded-3xl border border-blue-500/20 flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-2xl shrink-0">
                                <Flame size={32} className="text-blue-400" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Bonus Racha (+2 pts)</div>
                                <div className="text-xl font-bold text-white">{result.bonusWinner.name}</div>
                                <div className="text-sm text-neutral-400">Racha de {result.bonusWinner.streak} victorias</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={onClose}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-4 rounded-2xl text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yellow-500/20"
                        >
                            Continuar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}



export default function Dashboard() {
    const [stats, setStats] = useState<DailyStat[]>([])
    const [kingId, setKingId] = useState<string | null>(null)
    const [maxStreakPlayer, setMaxStreakPlayer] = useState<{ name: string, streak: number } | null>(null)
    const [dayResult, setDayResult] = useState<{
        bonusWinner: { name: string, streak: number },
        dayWinner: { name: string, points: number }
    } | null>(null)

    useEffect(() => {
        fetchData()
        const channel = supabase.channel('dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, () => {
                console.log('Stats updated')
                fetchData()
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => {
                console.log('Match inserted')
                fetchData()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchData() {
        console.log("Fetching Data...")
        const today = new Date().toISOString().split('T')[0]

        // 1. Get Stats (Daily Ranking)
        const { data: statsData } = await supabase
            .from('daily_stats')
            .select('*, player:players(*)')
            .eq('date', today)
            .order('points', { ascending: false })

        if (statsData) {
            // @ts-ignore
            setStats(statsData)
            // @ts-ignore
            const topStreak = statsData.reduce((prev, current) => (current.max_streak > prev.max_streak ? current : prev), { max_streak: 0 })
            if (topStreak.max_streak > 0) {
                setMaxStreakPlayer({
                    name: topStreak.player.name,
                    streak: topStreak.max_streak
                })
            } else {
                setMaxStreakPlayer(null)
            }
        } else {
            setStats([]) // Clear if null
        }

        // 2. Get King
        const { data: kingData } = await supabase.from('current_king').select('player_id').single()
        if (kingData) setKingId(kingData.player_id)
    }

    async function closeDay() {
        if (!confirm("¿CERRAR EL DÍA? \n\nEsto reiniciará el ranking diario a CERO (visualmente) y otorgará los bonus.")) return;

        const { data, error } = await supabase.rpc('close_day_bonus')

        if (error) {
            alert('Error: ' + error.message)
            return
        }

        if (data && data.success) {
            fetchData() // Refresh data
            setDayResult({
                bonusWinner: data.bonus_winner,
                dayWinner: data.day_winner
            })
        } else {
            alert(data?.message || 'Error desconocido')
        }
    }

    const appUrl = window.location.origin;

    return (
        <div className="min-h-screen md:h-screen w-full bg-[#050505] text-white p-6 md:p-8 overflow-y-auto md:overflow-hidden font-sans flex flex-col">

            {/* Header */}
            <div className="relative flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-4 md:gap-8 z-10">
                    <div className="bg-gradient-to-b from-yellow-400 to-orange-600 h-16 w-3 rounded-full shadow-[0_0_20px_orange]"></div>
                    <div>
                        <h1 className="text-3xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 uppercase">
                            King of the Court
                        </h1>
                    </div>
                </div>

                {/* PC: Centered Logo */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none z-0">
                    <img src={Escudo} alt="Escudo UD Sanse" className="h-24 object-contain opacity-80" />
                </div>

                <div className="flex items-center gap-6 z-10">
                    {/* Mobile: Logo in top right - Larger */}
                    <img src={Escudo} alt="Escudo UD Sanse" className="md:hidden h-24 w-auto object-contain" />

                    {/* Stats Button: Hidden on Mobile */}
                    <Link to="/stats" className="hidden md:flex bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 px-8 py-4 rounded-3xl font-bold transition-all border border-neutral-700 items-center gap-3 text-xl">
                        <User size={24} /> Stats
                    </Link>

                    {/* Desktop Close Day Button */}
                    <button
                        onClick={closeDay}
                        className="hidden md:block bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-900/50 px-8 py-4 rounded-3xl font-bold uppercase tracking-widest text-lg transition-all"
                    >
                        Cerrar Día
                    </button>
                </div>
            </div>

            {/* Main Grid: Mobile (Flex Column) / Desktop (Grid 12) */}
            <div className="flex flex-col md:grid md:grid-cols-12 gap-8 flex-1 min-h-0">

                {/* COL 1: Daily Ranking (Desktop: Left / Mobile: Bottom) */}
                <div className="order-3 md:order-none col-span-1 md:col-span-6 flex flex-col min-h-[600px] md:min-h-0 bg-neutral-900/30 rounded-[3rem] border border-neutral-800 p-4 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-orange-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>

                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-neutral-800/50 mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_red]"></div>
                            <h2 className="text-3xl font-bold text-neutral-200 tracking-tight">EN VIVO</h2>
                        </div>
                        {maxStreakPlayer && (
                            <div className="flex items-center gap-2 bg-blue-900/20 px-4 py-2 rounded-full border border-blue-500/20">
                                <Flame size={20} className="text-blue-400" />
                                <span className="text-blue-300 text-sm font-bold uppercase truncate max-w-[200px]">Racha: {maxStreakPlayer.name} ({maxStreakPlayer.streak})</span>
                            </div>
                        )}
                    </div>

                    {/* Ranking List */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar space-y-4">
                        <AnimatePresence mode='popLayout'>
                            {stats.map((stat, index) => {
                                const isKing = stat.player_id === kingId;
                                return (
                                    <motion.div
                                        key={stat.player_id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className={clsx(
                                            "relative flex items-center p-5 rounded-3xl border-l-[8px] transition-all shadow-xl",
                                            isKing
                                                ? "bg-gradient-to-r from-yellow-950/60 to-neutral-900 border-yellow-500 py-6"
                                                : "bg-neutral-800/40 border-neutral-700 hover:bg-neutral-800/60"
                                        )}
                                    >
                                        <div className={clsx("w-12 md:w-16 text-center font-black italic text-3xl md:text-5xl", isKing ? "text-yellow-500" : "text-neutral-600")}>
                                            #{index + 1}
                                        </div>
                                        <div className="flex-1 pl-4 md:pl-6 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <span className={clsx("text-2xl md:text-4xl font-bold tracking-tight truncate", isKing ? "text-white" : "text-neutral-300")}>
                                                    {stat.player?.name}
                                                </span>
                                                {isKing && <Crown size={32} fill="currentColor" className="text-yellow-500 shrink-0" />}
                                            </div>
                                            <div className="flex gap-6 text-sm font-bold text-neutral-500 mt-2 uppercase tracking-wider">
                                                <span className="text-green-500 text-xl">{stat.wins} W</span>
                                                <span className="text-red-500 text-xl">{stat.losses} L</span>
                                                <span className="text-neutral-400 text-xl">Strk: {stat.current_streak}</span>
                                            </div>
                                        </div>
                                        <div className="text-right pl-4">
                                            <div className="text-4xl md:text-6xl font-black text-white leading-none tracking-tighter tabular-nums text-shadow-sm">
                                                {stat.points.toFixed(2)}
                                            </div>
                                            <div className="text-xs text-neutral-600 font-bold uppercase tracking-wider mt-1">Puntos</div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                        {stats.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
                                <Trophy size={80} className="mb-4" />
                                <span className="text-3xl font-bold">Esperando jugadores...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* COL 2: Kings + Total (Hidden on Mobile) */}
                <div className="hidden md:flex col-span-1 md:col-span-3 flex-col gap-8 min-h-0">
                    <div className="flex-1 min-h-0">
                        <DayWinnersBoard />
                    </div>
                    <div className="flex-1 min-h-0">
                        <TotalWinsBoard />
                    </div>
                </div>

                {/* COL 3: Reporter + QR (Desktop: Right / Mobile: Top) */}
                <div className="order-1 md:order-none col-span-1 md:col-span-3 flex flex-col gap-8 min-h-0">
                    {/* Reporter */}
                    <div className="flex-auto h-auto min-h-[350px] md:min-h-0 bg-neutral-900 rounded-[3rem] border border-neutral-800 p-2 shadow-2xl relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                        <div className="p-4">
                            <MatchReporter onSuccess={fetchData} />
                        </div>
                    </div>

                    {/* Mobile Only: Close Day Button (Middle) */}
                    <div className="order-2 md:hidden">
                        <button
                            onClick={closeDay}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-900/50 px-8 py-6 rounded-3xl font-bold uppercase tracking-widest text-2xl transition-all"
                        >
                            Cerrar Día
                        </button>
                    </div>

                    {/* QR Code (Hidden on Mobile) */}
                    <div className="hidden md:flex shrink-0 bg-white/5 rounded-[3rem] p-8 border border-white/5 items-center justify-center text-center gap-6">
                        <div className="bg-white p-3 rounded-2xl shadow-lg shadow-white/10 shrink-0">
                            <QRCode value={appUrl} size={84} />
                        </div>
                        <div className="text-left">
                            <div className="text-white font-bold text-3xl leading-none mb-2">Únete</div>
                            <div className="text-neutral-400 text-sm uppercase tracking-widest leading-tight">Escanea para<br />jugar</div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Day Result Modal */}
            {dayResult && <DayResultModal result={dayResult} onClose={() => setDayResult(null)} />}
        </div>
    )
}
