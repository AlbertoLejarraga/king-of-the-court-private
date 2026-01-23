import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Player, Cup, CupPlayer } from '../types'
import { Trophy, Users, Play, RefreshCw, ChevronRight, CheckCircle2, AlertCircle, Undo2 } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

function toRoman(num: number): string {
    if (isNaN(num)) return ''
    const romanMap: [number, string][] = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let result = '';
    let n = num;
    for (const [val, char] of romanMap) {
        while (n >= val) {
            result += char;
            n -= val;
        }
    }
    return result;
}

export default function CupManager() {
    const [cup, setCup] = useState<Cup | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [cupPlayers, setCupPlayers] = useState<CupPlayer[]>([])
    const [cupMatches, setCupMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Setup state
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
    const [isAddingPlayer, setIsAddingPlayer] = useState(false)
    const [newPlayerName, setNewPlayerName] = useState('')

    useEffect(() => {
        fetchInitialData()

        const channel = supabase.channel('cup_manager_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cups' }, () => fetchInitialData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cup_players' }, () => fetchInitialData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchInitialData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchInitialData() {
        setLoading(true)
        // 1. Fetch current active cup (latest)
        const { data: cupData } = await supabase
            .from('cups')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (cupData) setCup(cupData)

        // 2. Fetch all players with total wins
        const { data: playersData } = await supabase
            .from('player_total_wins')
            .select('*')
            .order('name')

        if (playersData) {
            const playersWithId = playersData.map(p => ({ ...p, id: p.player_id }))
            setPlayers(playersWithId as any)
            setSelectedPlayerIds(new Set(playersWithId.map(p => p.id)))
        }

        // 3. If cup active, fetch cup players
        if (cupData) {
            const { data: cpData } = await supabase
                .from('cup_players')
                .select('*, player:players(*)')
                .eq('cup_id', cupData.id)
            if (cpData) {
                // Enrich players with total wins from our local players state if needed, 
                // but better fetch it or use the already fetched playersData
                const enrichedCpData = cpData.map(cp => {
                    const pInfo = playersData?.find(p => p.player_id === cp.player_id)
                    return { ...cp, total_wins: pInfo?.total_wins || 0 }
                })
                setCupPlayers(enrichedCpData as any)
                if (cupData.status !== 'setup') {
                    setSelectedPlayerIds(new Set(cpData.map(cp => cp.player_id)))
                }
            }

            // 4. Fetch Cup Matches
            const { data: mData } = await supabase
                .from('matches')
                .select('*, winner:players!winner_id(name), loser:players!loser_id(name)')
                .eq('cup_id', cupData.id)
            if (mData) setCupMatches(mData)
        }
        setLoading(false)
    }


    async function handleAddPlayer() {
        if (!newPlayerName.trim()) return
        const { data, error } = await supabase
            .from('players')
            .insert([{ name: newPlayerName.trim() }])
            .select()
            .single()

        if (error) {
            alert('Error: ' + error.message)
        } else {
            const newPlayer = { ...(data as any), total_wins: 0, player_id: (data as any).id }
            setPlayers(prev => [...prev, newPlayer].sort((a, b) => a.name.localeCompare(b.name)))
            setSelectedPlayerIds(prev => new Set([...prev, (data as any).id]))
            setNewPlayerName('')
            setIsAddingPlayer(false)
        }
    }

    const togglePlayer = (id: string) => {
        const next = new Set(selectedPlayerIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedPlayerIds(next)
    }

    async function runDraw() {
        if (selectedPlayerIds.size < 2) {
            alert("Necesitas al menos 2 jugadores.")
            return
        }

        // 1. Create Cup if it doesn't exist or is in setup
        let currentCupId = cup?.id
        if (!cup || cup.status === 'setup') {
            const { count } = await supabase.from('cups').select('*', { count: 'exact', head: true })
            const nextNumber = (count || 0) + 1
            const roman = toRoman(nextNumber)

            const { data: newCup, error: cupError } = await supabase
                .from('cups')
                .insert([{ status: 'groups', name: `${roman} Matapi's Cup` }])
                .select()
                .single()

            if (cupError) {
                alert("Error creating cup: " + cupError.message)
                return
            }
            currentCupId = newCup.id
        }

        // 2. Shuffle and assign
        const shuffled = Array.from(selectedPlayerIds).sort(() => Math.random() - 0.5)
        const half = Math.ceil(shuffled.length / 2)
        const groupA = shuffled.slice(0, half)
        const groupB = shuffled.slice(half)

        const inserts = [
            ...groupA.map(pid => ({ cup_id: currentCupId, player_id: pid, group_name: 'A' })),
            ...groupB.map(pid => ({ cup_id: currentCupId, player_id: pid, group_name: 'B' }))
        ]

        // Clear previous assignments if any
        await supabase.from('cup_players').delete().eq('cup_id', currentCupId)

        const { error } = await supabase.from('cup_players').insert(inserts)
        if (error) {
            alert("Error in draw: " + error.message)
            return
        }

        if (cup?.status === 'setup') {
            await supabase.from('cups').update({ status: 'groups' }).eq('id', currentCupId)
        }

        fetchInitialData()
    }

    async function setFinalsMode(mode: string) {
        if (!cup) return
        const { error } = await supabase
            .from('cups')
            .update({ finals_mode: mode, status: 'finals' })
            .eq('id', cup.id)
        if (error) alert(error.message)
        else fetchInitialData()
    }

    async function finishCup(winnerId: string | null) {
        if (!cup) return

        if (!winnerId) {
            // This is "Start New Edition"
            //if (!confirm("¿Empezar una nueva Copa? Se perderán los datos de la actual.")) return
            setCup(null)
            setCupPlayers([])
            setCupMatches([])
            setSelectedPlayerIds(new Set(players.map(p => p.id)))
            return
        }

        const { error } = await supabase
            .from('cups')
            .update({ status: 'finished', winner_id: winnerId })
            .eq('id', cup.id)

        if (error) {
            alert(error.message)
            return
        }

        // Increment cup wins in standings
        await supabase.rpc('increment_cup_wins', { p_player_id: winnerId })
        fetchInitialData()
    }

    async function reportMatch(winnerId: string, loserId: string, phase: string) {
        if (!cup) return

        const { error } = await supabase
            .from('matches')
            .insert([{
                winner_id: winnerId,
                loser_id: loserId,
                match_type: 'cup',
                cup_id: cup.id,
                cup_phase: phase,
                points_awarded: 0
            }])

        if (error) {
            alert("Error reporting match: " + error.message)
        } else {
            fetchInitialData()
        }
    }

    async function undoMatch(matchId: string) {
        if (!confirm("¿Anular este partido?")) return
        const { error } = await supabase.rpc('undo_last_match', { p_match_id: matchId })
        if (error) alert(error.message)
        else fetchInitialData()
    }

    if (loading && !cup) return <div className="flex items-center justify-center h-full min-h-[400px]"><RefreshCw className="animate-spin text-blue-500" size={48} /></div>

    // --- SETUP VIEW ---
    if (!cup || cup.status === 'setup') {
        const included = players.filter(p => selectedPlayerIds.has(p.id))
        const excluded = players.filter(p => !selectedPlayerIds.has(p.id))

        return (
            <div className="flex flex-col h-full gap-8 p-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-4xl font-black text-white flex items-center gap-4">
                        <Users size={40} className="text-blue-500" /> Configuración de la Copa
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* Included Column */}
                    <div className="bg-neutral-900/50 rounded-[2rem] border border-green-500/20 p-6 flex flex-col min-h-0 shadow-xl">
                        <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-3">
                            <CheckCircle2 size={24} /> Jugadores Inscritos ({included.length})
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                            {included.map(p => (
                                <motion.button
                                    layout
                                    key={p.id}
                                    onClick={() => togglePlayer(p.id)}
                                    className="w-full flex justify-between items-center p-3 bg-neutral-800/50 hover:bg-neutral-700/50 rounded-xl border border-neutral-700 transition-all group"
                                >
                                    <span className="text-lg font-bold text-white uppercase">{p.name}</span>
                                    <ChevronRight className="text-neutral-600 group-hover:text-green-500 transition-colors" />
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Excluded Column */}
                    <div className="bg-neutral-900/50 rounded-[2rem] border border-red-500/20 p-6 flex flex-col min-h-0 shadow-xl">
                        <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-3">
                            <AlertCircle size={24} /> No Participan ({excluded.length})
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                            {excluded.map(p => (
                                <motion.button
                                    layout
                                    key={p.id}
                                    onClick={() => togglePlayer(p.id)}
                                    className="w-full flex justify-between items-center p-3 bg-neutral-800/20 hover:bg-neutral-800/50 rounded-xl border border-neutral-800 transition-all group"
                                >
                                    <span className="text-lg font-bold text-neutral-500 uppercase">{p.name}</span>
                                    <ChevronRight className="rotate-180 text-neutral-700 group-hover:text-red-500 transition-colors" />
                                </motion.button>
                            ))}

                            {/* Add Discreet Player */}
                            <div className="pt-4 mt-4 border-t border-neutral-800">
                                {!isAddingPlayer ? (
                                    <button onClick={() => setIsAddingPlayer(true)} className="w-full py-3 text-neutral-500 hover:text-white text-sm font-bold uppercase underline">
                                        + Añadir Jugador Nuevo
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newPlayerName}
                                            onChange={e => setNewPlayerName(e.target.value)}
                                            placeholder="Nombre..."
                                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500"
                                        />
                                        <button onClick={handleAddPlayer} className="bg-blue-600 px-4 py-2 rounded-xl font-bold">Añadir</button>
                                        <button onClick={() => setIsAddingPlayer(false)} className="text-neutral-500 px-2">✕</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-4">
                    <button
                        onClick={runDraw}
                        disabled={selectedPlayerIds.size < 2}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white px-12 py-6 rounded-3xl font-black text-2xl uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4"
                    >
                        <Play fill="currentColor" /> Iniciar Sorteo
                    </button>
                </div>
            </div>
        )
    }

    // --- GROUPS & FINALS VIEW ---
    if (cup.status === 'groups' || cup.status === 'finals' || cup.status === 'finished') {
        const groupAEntities = cupPlayers.filter(cp => cp.group_name === 'A')
        const groupBEntities = cupPlayers.filter(cp => cp.group_name === 'B')

        const calcStandings = (players: CupPlayer[], groupMatches: any[]) => {
            return players.map(p => {
                const wins = groupMatches.filter(m => m.winner_id === p.player_id).length
                const losses = groupMatches.filter(m => m.loser_id === p.player_id).length
                // @ts-ignore
                const totalHistoricalWins = p.total_wins || 0
                return { ...p, wins, losses, totalHistoricalWins }
            }).sort((a, b) => {
                // 1. More group wins
                if (b.wins !== a.wins) return b.wins - a.wins
                // 2. Tie-breaker: Fewer historical total wins (favor the underdog)
                if (a.totalHistoricalWins !== b.totalHistoricalWins) return a.totalHistoricalWins - b.totalHistoricalWins
                // 3. Last fallback: Less losses
                return a.losses - b.losses
            })
        }

        const standingsA = calcStandings(groupAEntities, cupMatches.filter(m => m.cup_phase === 'group_A'))
        const standingsB = calcStandings(groupBEntities, cupMatches.filter(m => m.cup_phase === 'group_B'))

        const allGroupsFinished =
            standingsA.length >= 2 && standingsB.length >= 2 &&
            (cupMatches.filter(m => m.cup_phase === 'group_A').length >= (standingsA.length * (standingsA.length - 1)) / 2) &&
            (cupMatches.filter(m => m.cup_phase === 'group_B').length >= (standingsB.length * (standingsB.length - 1)) / 2)

        return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full p-4 overflow-hidden">
                <div className="col-span-1 md:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0">
                    <GroupCard
                        name="Grupo A"
                        players={groupAEntities}
                        matches={cupMatches.filter(m => m.cup_phase === 'group_A')}
                        onReport={(w, l) => reportMatch(w, l, 'group_A')}
                        onUndo={undoMatch}
                    />
                    <GroupCard
                        name="Grupo B"
                        players={groupBEntities}
                        matches={cupMatches.filter(m => m.cup_phase === 'group_B')}
                        onReport={(w, l) => reportMatch(w, l, 'group_B')}
                        onUndo={undoMatch}
                    />
                </div>

                <div className="col-span-1 md:col-span-3 flex flex-col gap-8 min-h-0">
                    <FinalPhaseCard
                        cup={cup}
                        standingsA={standingsA}
                        standingsB={standingsB}
                        matches={cupMatches}
                        active={allGroupsFinished || cup.status === 'finals' || cup.status === 'finished'}
                        onSetMode={setFinalsMode}
                        onReport={reportMatch}
                        onFinish={finishCup}
                        onUndo={undoMatch}
                    />
                </div>

                {cup.status === 'finished' && <VictoryModal cup={cup} players={players} onClose={() => finishCup(null)} />}
            </div>
        )
    }

    return null
}

function GroupCard({ name, players, matches, onReport, onUndo }: {
    name: string,
    players: CupPlayer[],
    matches: any[],
    onReport: (w: string, l: string) => void,
    onUndo: (id: string) => void
}) {
    // Generate all possible round-robin matches
    const possibleMatches: [string, string][] = []
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            possibleMatches.push([players[i].player_id, players[j].player_id])
        }
    }

    // Calculate standings
    const standings = players.map(p => {
        const wins = matches.filter(m => m.winner_id === p.player_id).length
        const losses = matches.filter(m => m.loser_id === p.player_id).length
        // @ts-ignore
        const totalHistoricalWins = p.total_wins || 0
        return { ...p, wins, losses, totalHistoricalWins }
    }).sort((a, b) => {
        // 1. More group wins
        if (b.wins !== a.wins) return b.wins - a.wins
        // 2. Tie-breaker: Fewer historical total wins (favor the underdog)
        if (a.totalHistoricalWins !== b.totalHistoricalWins) return a.totalHistoricalWins - b.totalHistoricalWins
        // 3. Last fallback: Less losses
        return a.losses - b.losses
    })

    return (
        <div className="flex flex-col min-h-0 bg-neutral-900/50 rounded-[3rem] border border-neutral-800 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-2xl font-black text-white mb-6 uppercase italic tracking-tighter">{name}</h3>

            <div className="flex-1 flex flex-col gap-6 min-h-0">
                {/* Table */}
                <div className="bg-neutral-800/30 rounded-3xl p-4 min-h-[200px]">
                    <div className="grid grid-cols-12 text-xs font-black text-neutral-500 uppercase tracking-widest px-4 mb-2">
                        <div className="col-span-1">#</div>
                        <div className="col-span-6">Jugador</div>
                        <div className="col-span-2 text-center">W</div>
                        <div className="col-span-1 text-center">L</div>
                        <div className="col-span-2 text-center text-[10px] leading-tight flex items-center justify-center">TOT. W</div>
                    </div>
                    <div className="space-y-1">
                        {standings.map((p, i) => (
                            <div key={p.player_id} className="grid grid-cols-12 items-center p-3 rounded-xl bg-neutral-800/40 border border-neutral-700/50 text-xl">
                                <div className="col-span-1 font-mono text-neutral-500">#{i + 1}</div>
                                <div className="col-span-6 font-bold text-white truncate">{p.player?.name}</div>
                                <div className="col-span-2 text-center font-bold text-green-500">{p.wins}</div>
                                <div className="col-span-1 text-center font-bold text-red-500">{p.losses}</div>
                                <div className="col-span-2 text-center font-bold text-neutral-500 text-sm">{(p as any).total_wins || 0}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Matches */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                    <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                        <Play size={14} fill="currentColor" /> Partidos
                    </h4>

                    <div className="space-y-2">
                        {possibleMatches.map(([p1Id, p2Id]) => {
                            const p1 = players.find(p => p.player_id === p1Id)?.player
                            const p2 = players.find(p => p.player_id === p2Id)?.player
                            const match = matches.find(m =>
                                (m.winner_id === p1Id && m.loser_id === p2Id) ||
                                (m.winner_id === p2Id && m.loser_id === p1Id)
                            )

                            if (!p1 || !p2) return null

                            return (
                                <div key={`${p1Id}-${p2Id}`} className={clsx(
                                    "p-4 rounded-2xl border transition-all flex items-center justify-between",
                                    match ? "bg-neutral-800/20 border-neutral-800 opacity-60" : "bg-neutral-800/60 border-neutral-700 hover:border-blue-500/50"
                                )}>
                                    <div className="flex items-center gap-4 flex-1">
                                        <button
                                            disabled={!!match}
                                            onClick={() => onReport(p1Id, p2Id)}
                                            className={clsx(
                                                "flex-1 text-center font-bold text-xl py-2 rounded-xl transition-all",
                                                match?.winner_id === p1Id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "hover:bg-white/5 text-neutral-300"
                                            )}
                                        >
                                            {p1.name}
                                        </button>
                                        <span className="text-neutral-600 font-black italic">VS</span>
                                        <button
                                            disabled={!!match}
                                            onClick={() => onReport(p2Id, p1Id)}
                                            className={clsx(
                                                "flex-1 text-center font-bold text-xl py-2 rounded-xl transition-all",
                                                match?.winner_id === p2Id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "hover:bg-white/5 text-neutral-300"
                                            )}
                                        >
                                            {p2.name}
                                        </button>
                                    </div>
                                    {match && (
                                        <button onClick={() => onUndo(match.id)} className="ml-4 p-2 text-neutral-700 hover:text-orange-500 transition-colors">
                                            <Undo2 size={20} />
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

function FinalPhaseCard({ cup, standingsA, standingsB, matches, active, onSetMode, onReport, onFinish, onUndo }: any) {
    if (!active) {
        return (
            <div className="flex-1 bg-neutral-900/50 rounded-[2.5rem] border border-neutral-800 p-6 flex flex-col items-center justify-center text-center opacity-50 grayscale transition-all hover:grayscale-0 hover:bg-neutral-800/80 group">
                <h3 className="text-xl font-bold text-neutral-500 group-hover:text-blue-400 mb-4 uppercase tracking-widest">Fase Final</h3>
                <Trophy size={64} className="mb-4 text-neutral-600 group-hover:text-blue-500 animate-pulse" />
                <p className="text-sm text-neutral-600 uppercase font-black group-hover:text-neutral-400">Termina los grupos para activar</p>
            </div>
        )
    }

    if (cup.finals_mode === 'none') {
        return (
            <div className="flex-1 bg-neutral-900/50 rounded-[2.5rem] border border-blue-500/30 p-8 flex flex-col shadow-2xl">
                <h3 className="text-2xl font-black text-white mb-6 uppercase italic tracking-tighter text-center">Configurar Finales</h3>
                <div className="space-y-4">
                    <button onClick={() => onSetMode('semi_final_final')} className="w-full p-6 bg-blue-600/20 border border-blue-500/50 rounded-2xl hover:bg-blue-600/40 transition-all font-bold text-lg">Semifinales y Final</button>
                    <button onClick={() => onSetMode('third_fourth_semi_final')} className="w-full p-6 bg-blue-600/20 border border-blue-500/50 rounded-2xl hover:bg-blue-600/40 transition-all font-bold text-lg">3º/4º puesto + Semis</button>
                    <button onClick={() => onSetMode('only_final')} className="w-full p-6 bg-blue-600/20 border border-blue-500/50 rounded-2xl hover:bg-blue-600/40 transition-all font-bold text-lg">Solo FINAL</button>
                </div>
            </div>
        )
    }

    // Bracket Logic
    const finalsMatches = matches.filter((m: any) => ['semi_1', 'semi_2', 'final', 'third_fourth'].includes(m.cup_phase))

    // Semis
    const semi1 = { p1: standingsA[0], p2: standingsB[1], phase: 'semi_1' }
    const semi2 = { p1: standingsB[0], p2: standingsA[1], phase: 'semi_2' }

    const mS1 = finalsMatches.find((m: any) => m.cup_phase === 'semi_1')
    const mS2 = finalsMatches.find((m: any) => m.cup_phase === 'semi_2')

    // Final
    let finalP1: any, finalP2: any
    if (cup.finals_mode === 'only_final') {
        finalP1 = standingsA[0]
        finalP2 = standingsB[0]
    } else {
        finalP1 = mS1 ? (mS1.winner_id === semi1.p1.player_id ? semi1.p1 : semi1.p2) : null
        finalP2 = mS2 ? (mS2.winner_id === semi2.p1.player_id ? semi2.p1 : semi2.p2) : null
    }

    const mF = finalsMatches.find((m: any) => m.cup_phase === 'final')

    // Third Fourth
    let t4P1: any, t4P2: any
    if (mS1 && mS2 && cup.finals_mode === 'third_fourth_semi_final') {
        t4P1 = mS1.winner_id === semi1.p1.player_id ? semi1.p2 : semi1.p1
        t4P2 = mS2.winner_id === semi2.p1.player_id ? semi2.p2 : semi2.p1
    }
    const mT4 = finalsMatches.find((m: any) => m.cup_phase === 'third_fourth')

    return (
        <div className="flex-1 bg-neutral-900/80 rounded-[2.5rem] border border-blue-500/20 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <h3 className="text-xl font-black text-blue-400 uppercase tracking-widest text-center border-b border-blue-500/20 pb-4">Fase Eliminatoria</h3>

            {(cup.finals_mode === 'semi_final_final' || cup.finals_mode === 'third_fourth_semi_final') && (
                <>
                    <EliminationMatch title="Semifinal 1" p1={semi1.p1} p2={semi1.p2} match={mS1} onReport={(w: any, l: any) => onReport(w, l, 'semi_1')} onUndo={onUndo} />
                    <EliminationMatch title="Semifinal 2" p1={semi2.p1} p2={semi2.p2} match={mS2} onReport={(w: any, l: any) => onReport(w, l, 'semi_2')} onUndo={onUndo} />
                </>
            )}

            {cup.finals_mode === 'third_fourth_semi_final' && (
                <EliminationMatch title="3er y 4º Puesto" p1={t4P1} p2={t4P2} match={mT4} onReport={(w: any, l: any) => onReport(w, l, 'third_fourth')} onUndo={onUndo} />
            )}

            {(cup.finals_mode === 'only_final' || cup.finals_mode === 'semi_final_final' || cup.finals_mode === 'third_fourth_semi_final') && (
                <EliminationMatch
                    title="🔥 GRAN FINAL 🔥"
                    p1={finalP1}
                    p2={finalP2}
                    match={mF}
                    highlight
                    onReport={(w: any, l: any) => onReport(w, l, 'final')}
                    onUndo={onUndo}
                    onFinish={onFinish}
                />
            )}

            {cup.status === 'finished' && (
                <div className="mt-auto pt-6 border-t border-neutral-800 text-center">
                    <p className="text-neutral-500 font-bold uppercase text-xs mb-2">Copa Finalizada</p>
                    <button onClick={() => onFinish(null)} className="text-neutral-600 hover:text-white underline text-xs">Iniciar nueva edición</button>
                </div>
            )}
        </div>
    )
}

function EliminationMatch({ title, p1, p2, match, highlight, onReport, onUndo, onFinish }: any) {

    if (!p1 || !p2) return (
        <div className="p-4 bg-neutral-800/20 rounded-2xl border border-neutral-800/50 opacity-40">
            <div className="text-[10px] font-black uppercase text-neutral-600 mb-2">{title}</div>
            <div className="text-center italic text-neutral-700">Esperando jugadores...</div>
        </div>
    )

    return (
        <div className={clsx(
            "p-5 rounded-3xl border transition-all flex flex-col gap-3",
            highlight ? "bg-gradient-to-br from-yellow-900/30 to-black/60 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)]" : "bg-neutral-800/40 border-neutral-700"
        )}>
            <div className={clsx("text-xs font-black uppercase tracking-widest", highlight ? "text-yellow-500" : "text-neutral-500")}>{title}</div>
            <div className="flex items-center gap-2">
                <button
                    disabled={!!match}
                    onClick={() => onReport(p1.player_id, p2.player_id)}
                    className={clsx(
                        "flex-1 py-3 rounded-2xl font-bold text-lg transition-all",
                        match?.winner_id === p1.player_id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-neutral-700/50 hover:bg-neutral-600 text-neutral-300"
                    )}
                >
                    {p1.player?.name}
                </button>
                <span className="font-black italic text-neutral-600 px-1">VS</span>
                <button
                    disabled={!!match}
                    onClick={() => onReport(p2.player_id, p1.player_id)}
                    className={clsx(
                        "flex-1 py-3 rounded-2xl font-bold text-lg transition-all",
                        match?.winner_id === p2.player_id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-neutral-700/50 hover:bg-neutral-600 text-neutral-300"
                    )}
                >
                    {p2.player?.name}
                </button>
            </div>
            {match && (
                <div className="flex justify-between items-center mt-1">
                    <button onClick={() => onUndo(match.id)} className="text-neutral-600 hover:text-orange-500 text-xs flex items-center gap-1">
                        <Undo2 size={12} /> Deshacer
                    </button>
                    {highlight && onFinish && (
                        <button
                            onClick={() => onFinish(match.winner_id)}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1 rounded-full text-xs font-black uppercase"
                        >
                            Declarar Vencedor
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

function VictoryModal({ cup, players, onClose }: any) {
    const winner = players.find((p: any) => p.id === cup.winner_id)
    if (!winner) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
                <motion.div
                    initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="relative bg-gradient-to-b from-neutral-800 to-neutral-900 border-2 border-yellow-500/50 p-12 rounded-[4rem] text-center max-w-2xl w-full shadow-[0_0_100px_rgba(234,179,8,0.3)] overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 animate-pulse"></div>

                    <motion.div
                        animate={{
                            y: [0, -20, 0],
                            scale: [1, 1.1, 1]
                        }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="mb-8 flex justify-center"
                    >
                        <Trophy size={120} className="text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />
                    </motion.div>

                    <h2 className="text-3xl font-bold text-yellow-500 uppercase tracking-[0.2em] mb-4">Campeón de la {cup.name}</h2>
                    <h1 className="text-7xl font-black text-white uppercase italic tracking-tighter mb-8 glow-text">
                        {winner.name}
                    </h1>

                    <button
                        onClick={onClose}
                        className="bg-white text-black px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-xl hover:bg-neutral-200 transition-all transform hover:scale-110 active:scale-95 shadow-2xl"
                    >
                        Continuar
                    </button>

                    <p className="mt-8 text-neutral-500 font-bold uppercase text-xs">Matapi's Cup 2025 Edition</p>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
