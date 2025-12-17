import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { DailyStat } from '../types'
import { Crown, Flame } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

export default function Leaderboard() {
    const [stats, setStats] = useState<DailyStat[]>([])
    const [kingId, setKingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Polling or Realtime subscription?
    // Realtime is better for "TV"feel.
    useEffect(() => {
        fetchLeaderboard()
        fetchKing()

        // Realtime subscription to 'daily_stats' changes
        const subscription = supabase
            .channel('leaderboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, () => {
                fetchLeaderboard()
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => {
                fetchKing()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [])

    async function fetchLeaderboard() {
        const today = new Date().toISOString().split('T')[0]

        // We join with players to get names
        const { data, error } = await supabase
            .from('daily_stats')
            .select('*, player:players(*)')
            .eq('date', today)
            .order('points', { ascending: false })

        if (error) console.error('Error loading leaderboard:', error)
        if (data) setStats(data as unknown as DailyStat[])
        setLoading(false)
    }

    async function fetchKing() {
        const { data } = await supabase.from('current_king').select('player_id').single()
        if (data) setKingId(data.player_id)
    }

    // Find max streak for the bonus indicator
    const todayTopStreak = Math.max(...stats.map(s => s.max_streak), 0)

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-6 md:p-12 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600">
                        KING OF THE COURT
                    </h1>
                    <p className="text-neutral-400 mt-2 text-xl font-medium tracking-widest uppercase">
                        Daily Live Ranking
                    </p>
                </div>

                {/* Daily Bonus Tracker */}
                <div className="bg-neutral-800/50 backdrop-blur-md border border-neutral-700 rounded-2xl p-4 flex items-center gap-4">
                    <div className="bg-blue-500/20 p-3 rounded-full text-blue-400">
                        <Flame size={32} fill="currentColor" />
                    </div>
                    <div>
                        <div className="text-xs text-neutral-400 uppercase font-bold">Longest Streak Reward (2pts)</div>
                        <div className="text-2xl font-bold flex items-baseline gap-2">
                            <span className="text-white">{todayTopStreak} Wins</span>
                            <span className="text-sm text-neutral-500">Target</span>
                        </div>
                    </div>
                </div>
            </div>

            {loading && <div className="text-center text-2xl animate-pulse">Loading Ranking...</div>}

            <div className="grid gap-4 max-w-7xl mx-auto">
                <AnimatePresence>
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.player_id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={clsx(
                                "relative flex items-center p-4 md:p-6 rounded-2xl border-2 transition-all shadow-xl",
                                stat.player_id === kingId
                                    ? "bg-gradient-to-r from-yellow-900/40 to-neutral-900 border-yellow-500/50 order-first mb-8 scale-105 z-10"
                                    : "bg-neutral-800/60 border-neutral-800"
                            )}
                        >
                            {/* Rank */}
                            <div className="w-16 md:w-24 text-center font-black text-4xl md:text-5xl text-neutral-600 italic">
                                #{index + 1}
                            </div>

                            {/* Player Info */}
                            <div className="flex-1 pl-4 md:pl-8">
                                <div className="flex items-center gap-3">
                                    <h2 className={clsx(
                                        "text-2xl md:text-4xl font-bold tracking-tight",
                                        stat.player_id === kingId ? "text-yellow-400" : "text-white"
                                    )}>
                                        {stat.player?.name}
                                    </h2>
                                    {stat.player_id === kingId && (
                                        <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1 animate-pulse">
                                            <Crown size={14} fill="black" /> Current King
                                        </div>
                                    )}
                                    {stat.max_streak === todayTopStreak && todayTopStreak > 0 && (
                                        <div className="bg-blue-600/30 text-blue-400 border border-blue-500/50 px-2 py-1 rounded text-xs font-bold" title="Longest Streak Holder">
                                            🔥 {stat.max_streak} Streak
                                        </div>
                                    )}
                                </div>
                                <div className="text-neutral-400 text-sm md:text-base mt-1 flex gap-4">
                                    <span>W: {stat.wins}</span>
                                    <span>L: {stat.losses}</span>
                                    <span>Str: {stat.current_streak}</span>
                                </div>
                            </div>

                            {/* Points */}
                            <div className="text-right">
                                <div className="text-sm text-neutral-500 uppercase font-bold tracking-wider">Points</div>
                                <div className="text-4xl md:text-5xl font-black text-white tabular-nums tracking-tight">
                                    {stat.points.toFixed(2)}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {!loading && stats.length === 0 && (
                    <div className="text-center py-20 bg-neutral-800/30 rounded-3xl border border-dashed border-neutral-700">
                        <h3 className="text-2xl text-neutral-400 font-bold mb-4">No matches today yet!</h3>
                        <p className="text-neutral-500">Be the first to claim the throne.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
