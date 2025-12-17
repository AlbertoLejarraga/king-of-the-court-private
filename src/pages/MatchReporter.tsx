import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Player } from '../types'
import { Check, Send, X } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

interface MatchPoints {
    points_awarded: number
    base: number
    bonus: number
    multiplier: number
    daily_percentile: number
    global_percentile: number
    composite_percentile: number
}

function ScoreModal({ data, onClose }: { data: MatchPoints, onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 10000)
        return () => clearTimeout(timer)
    }, [onClose])

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-[2rem] max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
                    <X size={24} />
                </button>

                <h3 className="text-3xl font-black text-center mb-6 text-white uppercase italic tracking-tighter">
                    ¡Partido Reportado!
                </h3>

                <div className="space-y-4">
                    <div className="flex justify-between items-center text-lg">
                        <span className="text-neutral-400">Puntos Base:</span>
                        <span className="font-bold text-white">{data.base.toFixed(2)}</span>
                    </div>
                    {data.bonus > 0 && (
                        <div className="flex justify-between items-center text-lg text-yellow-500 font-bold">
                            <span className="flex items-center gap-2">👑 King Bonus:</span>
                            <span>+{data.bonus}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-lg">
                        <span className="text-neutral-400">Multiplicador Rival:</span>
                        <div className="text-right">
                            <span className={clsx("font-bold block", data.multiplier >= 1.3 ? "text-green-500" : data.multiplier <= 0.7 ? "text-red-500" : "text-blue-500")}>
                                x{data.multiplier}
                            </span>
                            <span className="text-xs text-neutral-600 uppercase tracking-widest">
                                (Nivel: {data.composite_percentile <= 0.3 ? 'TOP' : data.composite_percentile <= 0.7 ? 'MID' : 'LOW'})
                            </span>
                        </div>
                    </div>

                    <div className="h-px bg-neutral-800 my-4"></div>

                    <div className="flex justify-between items-center text-4xl font-black italic">
                        <span className="text-white">TOTAL</span>
                        <span className="text-green-500">+{data.points_awarded.toFixed(2)}</span>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-neutral-600 animate-[width_10s_linear_forwards]" style={{ width: '100%' }}></div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default function MatchReporter({ onSuccess }: { onSuccess?: () => void }) {
    const [players, setPlayers] = useState<Player[]>([])
    const [winner, setWinner] = useState<string>('')
    const [loser, setLoser] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [matchData, setMatchData] = useState<MatchPoints | null>(null)

    // New Player State
    const [isAddingPlayer, setIsAddingPlayer] = useState(false)
    const [newPlayerName, setNewPlayerName] = useState('')
    const [addingLoading, setAddingLoading] = useState(false)

    useEffect(() => {
        fetchPlayers()
    }, [])

    async function fetchPlayers() {
        const { data } = await supabase.from('players').select('*').order('name')
        if (data) setPlayers(data)
    }

    async function handleSubmit() {
        if (!winner || !loser || winner === loser) return
        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('report_match', { p_winner_id: winner, p_loser_id: loser })
            if (!error && data) {
                setMatchData(data as MatchPoints)
                setWinner('')
                setLoser('')
                if (onSuccess) onSuccess()
            } else if (error) {
                alert("Error: " + error.message)
            }
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    async function handleAddPlayer() {
        if (!newPlayerName.trim()) return
        setAddingLoading(true)
        const { error } = await supabase.from('players').insert([{ name: newPlayerName.trim() }]).select()
        if (error) {
            alert('Error creating player: ' + error.message)
        } else {
            setNewPlayerName('')
            setIsAddingPlayer(false)
            fetchPlayers() // Refresh list
        }
        setAddingLoading(false)
    }

    return (
        <>
            <AnimatePresence>
                {matchData && <ScoreModal data={matchData} onClose={() => setMatchData(null)} />}
            </AnimatePresence>

            <div className="p-4 text-white h-auto flex flex-col justify-center">
                <div className="space-y-3">
                    <select
                        className="w-full bg-neutral-800 border border-neutral-700 text-white font-bold text-lg rounded-xl p-3 outline-none focus:border-green-500 transition-colors"
                        value={winner} onChange={e => setWinner(e.target.value)}
                    >
                        <option value="" className="text-gray-500">🏆 Ganador...</option>
                        {players.map(p => <option key={p.id} value={p.id} className="text-white">{p.name}</option>)}
                    </select>

                    <select
                        className="w-full bg-neutral-800 border border-neutral-700 text-white font-bold text-lg rounded-xl p-3 outline-none focus:border-red-500 transition-colors"
                        value={loser} onChange={e => setLoser(e.target.value)}
                    >
                        <option value="" className="text-gray-500">💀 Perdedor...</option>
                        {players.map(p => <option key={p.id} value={p.id} className="text-white">{p.name}</option>)}
                    </select>

                    <button
                        onClick={handleSubmit}
                        disabled={!winner || !loser || loading}
                        className="w-full bg-white text-black font-black text-lg py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 disabled:opacity-50 transition-transform active:scale-95"
                    >
                        {loading ? '...' : <><Send size={18} /> REPORTAR</>}
                    </button>

                    {/* Add Player Section */}
                    <div className="pt-2 border-t border-neutral-800 mt-2">
                        {!isAddingPlayer ? (
                            <button
                                onClick={() => setIsAddingPlayer(true)}
                                className="text-xs text-neutral-500 hover:text-white underline w-full text-center"
                            >
                                ¿Jugador nuevo? Añádelo aquí
                            </button>
                        ) : (
                            <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <input
                                    type="text"
                                    placeholder="Nombre..."
                                    className="flex-1 bg-neutral-800 rounded-lg px-3 py-2 text-sm border border-neutral-700 outline-none focus:border-blue-500"
                                    value={newPlayerName}
                                    onChange={e => setNewPlayerName(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    onClick={handleAddPlayer}
                                    disabled={addingLoading || !newPlayerName}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                                >
                                    {addingLoading ? '...' : <Check size={16} />}
                                </button>
                                <button
                                    onClick={() => setIsAddingPlayer(false)}
                                    className="text-neutral-500 hover:text-red-500 px-2"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
