import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Player, DoublesTeam } from '../types'
import { Check, Send, X, Users } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

interface MatchPoints {
    points_awarded: number
    base: number
    bonus: number
    multiplier: number
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

                <h3 className="text-3xl font-black text-center mb-6 text-white uppercase italic tracking-tighter flex items-center justify-center gap-2">
                    <Users size={32} className="text-blue-500" /> ¡Partido de Parejas Reportado!
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
                        <div className="h-full bg-blue-600 animate-[width_10s_linear_forwards]" style={{ width: '100%' }}></div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default function DoublesMatchReporter({ onSuccess }: { onSuccess?: () => void }) {
    const [teams, setTeams] = useState<DoublesTeam[]>([])
    const [players, setPlayers] = useState<Player[]>([])
    const [winner, setWinner] = useState<string>('')
    const [loser, setLoser] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [matchData, setMatchData] = useState<MatchPoints | null>(null)

    // New Team State
    const [isAddingTeam, setIsAddingTeam] = useState(false)
    const [player1Id, setPlayer1Id] = useState('')
    const [player2Id, setPlayer2Id] = useState('')
    const [addingLoading, setAddingLoading] = useState(false)

    // New Player State
    const [isAddingPlayer, setIsAddingPlayer] = useState(false)
    const [newPlayerName, setNewPlayerName] = useState('')
    const [addingPlayerLoading, setAddingPlayerLoading] = useState(false)

    useEffect(() => {
        fetchTeamsAndPlayers()
    }, [])

    async function fetchTeamsAndPlayers() {
        const [teamsResp, playersResp] = await Promise.all([
            supabase.from('doubles_teams').select('*').order('name'),
            supabase.from('players').select('*').order('name')
        ])
        
        if (teamsResp.data) setTeams(teamsResp.data as DoublesTeam[])
        if (playersResp.data) setPlayers(playersResp.data)
    }

    async function handleSubmit() {
        if (!winner || !loser || winner === loser) return
        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('report_doubles_match', { p_winner_team_id: winner, p_loser_team_id: loser })
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

    async function handleAddTeam() {
        if (!player1Id || !player2Id || player1Id === player2Id) return
        setAddingLoading(true)
        
        // Find players for the name
        const p1 = players.find(p => p.id === player1Id)
        const p2 = players.find(p => p.id === player2Id)
        
        if (!p1 || !p2) {
            setAddingLoading(false)
            return
        }

        // Sort IDs to keep combination unique-friendly (if needed)
        const sortedIds = [player1Id, player2Id].sort()
        const teamName = `${p1.name} ♥ ${p2.name}`
        
        const { error } = await supabase.from('doubles_teams').insert([{ 
            name: teamName,
            player1_id: sortedIds[0],
            player2_id: sortedIds[1]
        }])
        
        if (error) {
            // Check for unique constraint violation
            if (error.code === '23505') {
                alert('Esta pareja ya existe.')
            } else {
                alert('Error al crear pareja: ' + error.message)
            }
        } else {
            setPlayer1Id('')
            setPlayer2Id('')
            setIsAddingTeam(false)
            fetchTeamsAndPlayers() // Refresh list
        }
        setAddingLoading(false)
    }

    async function handleAddPlayer() {
        if (!newPlayerName.trim()) return
        setAddingPlayerLoading(true)
        const { error } = await supabase.from('players').insert([{ name: newPlayerName.trim() }]).select()
        if (error) {
            alert('Error creating player: ' + error.message)
        } else {
            setNewPlayerName('')
            setIsAddingPlayer(false)
            fetchTeamsAndPlayers() // Refresh list
        }
        setAddingPlayerLoading(false)
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
                        <option value="" className="text-gray-500">🏆 Ganadores...</option>
                        {teams.map(t => <option key={t.id} value={t.id} className="text-white">{t.name.replace(' & ', ' ♥ ')}</option>)}
                    </select>

                    <select
                        className="w-full bg-neutral-800 border border-neutral-700 text-white font-bold text-lg rounded-xl p-3 outline-none focus:border-red-500 transition-colors"
                        value={loser} onChange={e => setLoser(e.target.value)}
                    >
                        <option value="" className="text-gray-500">💀 Perdedores...</option>
                        {teams.map(t => <option key={t.id} value={t.id} className="text-white">{t.name.replace(' & ', ' ♥ ')}</option>)}
                    </select>

                    <button
                        onClick={handleSubmit}
                        disabled={!winner || !loser || winner === loser || loading}
                        className="w-full bg-white text-black font-black text-lg py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 disabled:opacity-50 transition-transform active:scale-95"
                    >
                        {loading ? '...' : <><Send size={18} /> REPORTAR PAREJAS</>}
                    </button>

                    {/* Add Team Section */}
                    <div className="pt-2 border-t border-neutral-800 mt-2">
                        {!isAddingTeam ? (
                            <button
                                onClick={() => setIsAddingTeam(true)}
                                className="text-xs text-neutral-500 hover:text-white underline w-full text-center flex items-center justify-center gap-1"
                            >
                                <Users size={14} /> ¿Nueva Pareja? Créala aquí
                            </button>
                        ) : (
                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest px-1">Registrar Pareja V2</span>
                                <select
                                    className="bg-neutral-800 rounded-lg px-3 py-2 text-sm border border-neutral-700 outline-none focus:border-blue-500"
                                    value={player1Id} onChange={e => setPlayer1Id(e.target.value)}
                                >
                                    <option value="">Selecciona Jugador 1...</option>
                                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <select
                                    className="bg-neutral-800 rounded-lg px-3 py-2 text-sm border border-neutral-700 outline-none focus:border-blue-500"
                                    value={player2Id} onChange={e => setPlayer2Id(e.target.value)}
                                >
                                    <option value="">Selecciona Jugador 2...</option>
                                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={handleAddTeam}
                                        disabled={addingLoading || !player1Id || !player2Id || player1Id === player2Id}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {addingLoading ? '...' : <><Check size={16} /> Crear</>}
                                    </button>
                                    <button
                                        onClick={() => setIsAddingTeam(false)}
                                        className="text-neutral-500 hover:text-red-500 px-4 flex items-center justify-center border border-neutral-800 rounded-lg"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Add Player Section (Below Add Team) */}
                        <div className="mt-2 pt-2 border-t border-neutral-800 border-dashed">
                            {!isAddingPlayer ? (
                                <button
                                    onClick={() => setIsAddingPlayer(true)}
                                    className="text-xs text-neutral-500 hover:text-white underline w-full text-center"
                                >
                                    ¿Falta un jugador? Añádelo aquí primero
                                </button>
                            ) : (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300 mt-1">
                                    <input
                                        type="text"
                                        placeholder="Nombre del jugador..."
                                        className="flex-1 bg-neutral-800 rounded-lg px-3 py-2 text-sm border border-neutral-700 outline-none focus:border-blue-500"
                                        value={newPlayerName}
                                        onChange={(e) => setNewPlayerName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                                    />
                                    <button
                                        onClick={handleAddPlayer}
                                        disabled={addingPlayerLoading || !newPlayerName.trim()}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {addingPlayerLoading ? '...' : <Check size={16} />}
                                    </button>
                                    <button
                                        onClick={() => setIsAddingPlayer(false)}
                                        className="text-neutral-500 hover:text-red-500 px-2 flex items-center justify-center"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
