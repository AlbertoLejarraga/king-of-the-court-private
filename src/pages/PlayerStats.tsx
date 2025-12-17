import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { TrendingUp, Target } from 'lucide-react'

// Extended interface for local use
interface PlayerHistory {
    date: string
    points: number
    wins: number
    losses: number
    rank: number
}

export default function PlayerStats() {
    const [players, setPlayers] = useState<any[]>([])
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
    const [history, setHistory] = useState<PlayerHistory[]>([])

    useEffect(() => {
        supabase.from('players').select('*').order('name').then(({ data }) => {
            if (data) setPlayers(data)
        })
    }, [])

    useEffect(() => {
        if (selectedPlayerId) {
            fetchHistory(selectedPlayerId)
        }
    }, [selectedPlayerId])

    async function fetchHistory(playerId: string) {
        const { data } = await supabase
            .from('daily_stats')
            .select('*')
            .eq('player_id', playerId)
            .order('date', { ascending: false })
            .limit(10)

        if (data) setHistory(data as any[])
    }

    const totalWins = history.reduce((acc, curr) => acc + curr.wins, 0)
    const totalLosses = history.reduce((acc, curr) => acc + curr.losses, 0)
    const winRate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0

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

            {selectedPlayerId && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700">
                            <div className="text-neutral-400 text-xs uppercase font-bold flex items-center gap-2">
                                <TrendingUp size={16} /> Victoria %
                            </div>
                            <div className="text-3xl font-black mt-1 py-2">{winRate}%</div>
                        </div>
                        <div className="bg-neutral-800 p-4 rounded-xl border border-neutral-700">
                            <div className="text-neutral-400 text-xs uppercase font-bold flex items-center gap-2">
                                <Target size={16} /> Total Partidos
                            </div>
                            <div className="text-3xl font-black mt-1 py-2">{totalWins + totalLosses}</div>
                        </div>
                    </div>

                    {/* History List */}
                    <h3 className="text-xl font-bold mt-8 mb-4">Últimos 10 Días</h3>
                    <div className="space-y-3">
                        {history.map(day => (
                            <div key={day.date} className="bg-neutral-800/50 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="text-sm text-neutral-400 font-bold">{day.date}</div>
                                    <div className="text-xs text-neutral-500 mt-1">Ranking: #{day.rank || '-'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-xl text-yellow-400">{day.points.toFixed(2)} pts</div>
                                    <div className="text-xs text-neutral-400">{day.wins}W - {day.losses}L</div>
                                </div>
                            </div>
                        ))}
                        {history.length === 0 && (
                            <div className="text-neutral-500 text-center py-8">Sin historial disponible.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
