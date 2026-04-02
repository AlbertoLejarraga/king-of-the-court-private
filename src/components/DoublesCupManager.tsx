import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import type { Player, DoublesTeam } from '../types'
import { Trophy, Users, Play, RefreshCw, ChevronRight, CheckCircle2, AlertCircle, Undo2, X } from 'lucide-react'
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

// Cup interfaces for Doubles
export interface DoublesCup {
    id: string;
    name: string;
    status: string;
    finals_mode: string;
    winner_team_id: string | null;
}

export interface DoublesCupTeam {
    cup_id: string;
    team_id: string;
    group_name: string;
    team?: DoublesTeam;
    wins?: number;
    losses?: number;
}

// Removed unused getWinPct

export default function DoublesCupManager() {
    const [cup, setCup] = useState<DoublesCup | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [playerStats, setPlayerStats] = useState<Record<string, { winPct: number, wins: number }>>({})
    const [cupTeams, setCupTeams] = useState<DoublesCupTeam[]>([])
    const [cupMatches, setCupMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Setup state
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set())
    const [isAddingPlayer, setIsAddingPlayer] = useState(false)
    const [newPlayerName, setNewPlayerName] = useState('')
    const [victoryDismissed, setVictoryDismissed] = useState(false)
    const viewingFinishedRef = useRef(false)

    useEffect(() => {
        if (cup?.status !== 'finished') {
            setVictoryDismissed(false)
            viewingFinishedRef.current = false
        } else {
            viewingFinishedRef.current = true
        }
    }, [cup?.status, cup?.id])

    useEffect(() => {
        fetchInitialData()

        const channel = supabase.channel('doubles_cup_manager_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doubles_cups' }, () => fetchInitialData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doubles_cup_teams' }, () => fetchInitialData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doubles_matches' }, () => fetchInitialData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchInitialData() {
        setLoading(true)

        // 1. Fetch current active cup
        const { data: cupData } = await supabase
            .from('doubles_cups')
            .select('*')
            .neq('status', 'finished')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (cupData) {
            setCup(cupData as DoublesCup)
        } else {
            if (!viewingFinishedRef.current) {
                setCup(null)
            }
        }

        // 2. Fetch all players and calculate historical win pct
        const { data: playersData } = await supabase.from('players').select('*').order('name')
        const { data: matchesData } = await supabase.from('matches').select('winner_id, loser_id').eq('match_type', 'regular')

        const stats: Record<string, { w: number, l: number }> = {}
        if (playersData) {
            playersData.forEach(p => stats[p.id] = { w: 0, l: 0 })
        }
        if (matchesData) {
            matchesData.forEach(m => {
                if (stats[m.winner_id]) stats[m.winner_id].w++;
                if (stats[m.loser_id]) stats[m.loser_id].l++;
            })
        }

        const formattedStats: Record<string, { winPct: number, wins: number }> = {}
        for (const [id, s] of Object.entries(stats)) {
            const tot = s.w + s.l;
            formattedStats[id] = {
                wins: s.w,
                winPct: tot === 0 ? 0 : s.w / tot
            }
        }
        setPlayerStats(formattedStats)

        if (playersData) {
            setPlayers(playersData)
            setSelectedPlayerIds(new Set(playersData.map(p => p.id)))
        }

        // 3. If cup active, fetch cup teams
        if (cupData) {
            const { data: ctData } = await supabase
                .from('doubles_cup_teams')
                .select('*, team:doubles_teams(*)')
                .eq('cup_id', cupData.id)

            if (ctData) {
                setCupTeams(ctData)
            }

            // 4. Fetch Doubles Cup Matches
            const { data: mData } = await supabase
                .from('doubles_matches')
                .select('*, winner:doubles_teams!doubles_matches_winner_team_id_fkey(name), loser:doubles_teams!doubles_matches_loser_team_id_fkey(name)')
                .eq('cup_id', cupData.id)

            if (mData) {
                // Enrich names using ♥
                const enriched = mData.map(m => ({
                    ...m,
                    winner_name: m.winner?.name?.replace(' & ', ' ♥ ') || 'Equpo',
                    loser_name: m.loser?.name?.replace(' & ', ' ♥ ') || 'Equipo'
                }))
                setCupMatches(enriched)
            }
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
            setPlayers(prev => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)))
            setSelectedPlayerIds(prev => new Set([...prev, (data as any).id]))
            setPlayerStats(prev => ({ ...prev, [(data as any).id]: { wins: 0, winPct: 0 } }))
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
        if (selectedPlayerIds.size < 4) {
            alert("Necesitas al menos 4 jugadores (2 parejas).")
            return
        }
        if (selectedPlayerIds.size % 2 !== 0) {
            alert("Para jugar por parejas, debes seleccionar un número PAR de participantes.")
            return
        }

        // 1. Balance teams
        // Rank players by win pct
        const pArray = Array.from(selectedPlayerIds).map(id => ({
            id,
            winPct: playerStats[id]?.winPct || 0
        })).sort((a, b) => b.winPct - a.winPct)

        const half = pArray.length / 2;
        const topHalf = pArray.slice(0, half).sort(() => Math.random() - 0.5);
        const bottomHalf = pArray.slice(half).sort(() => Math.random() - 0.5);

        const generatedTeams = []
        for (let i = 0; i < half; i++) {
            generatedTeams.push([topHalf[i].id, bottomHalf[i].id])
        }

        // Generate names and insert into doubles_teams if they don't exist
        const teamIds = []
        for (const [p1Id, p2Id] of generatedTeams) {
            const p1 = players.find(p => p.id === p1Id)
            const p2 = players.find(p => p.id === p2Id)
            if (!p1 || !p2) continue

            const sortedIds = [p1Id, p2Id].sort()
            const teamName = `${p1.name} ♥ ${p2.name}`

            // Upsert / Check exists
            const { data: existing } = await supabase
                .from('doubles_teams')
                .select('id')
                .eq('player1_id', sortedIds[0])
                .eq('player2_id', sortedIds[1])
                .single()

            if (existing) {
                teamIds.push(existing.id)
            } else {
                const { data: newTeam, error: insErr } = await supabase
                    .from('doubles_teams')
                    .insert([{ name: teamName, player1_id: sortedIds[0], player2_id: sortedIds[1] }])
                    .select('id')
                    .single()

                if (newTeam) {
                    teamIds.push(newTeam.id)
                } else if (insErr && insErr.code === '23505') {
                    // Parallel creation fallback
                    const { data: existing2 } = await supabase
                        .from('doubles_teams')
                        .select('id')
                        .eq('player1_id', sortedIds[0])
                        .eq('player2_id', sortedIds[1])
                        .single()
                    if (existing2) teamIds.push(existing2.id)
                }
            }
        }

        // 2. Create Cup
        let currentCupId = cup?.id
        if (!cup || cup.status === 'setup') {
            const { count } = await supabase.from('doubles_cups').select('*', { count: 'exact', head: true })
            const nextNumber = (count || 0) + 1
            const roman = toRoman(nextNumber)

            const { data: newCup, error: cupError } = await supabase
                .from('doubles_cups')
                .insert([{ status: 'groups', name: `${roman} Matapi's Cup Parejas` }])
                .select()
                .single()

            if (cupError) {
                alert("Error creating cup: " + cupError.message)
                return
            }
            currentCupId = newCup.id
        }

        // 3. Shuffle Teams and Assign Groups
        const shuffledTeams = teamIds.sort(() => Math.random() - 0.5)

        const inserts = []
        if (shuffledTeams.length >= 6) {
            // 3 Groups (A, B, C)
            const sizeA = Math.ceil(shuffledTeams.length / 3)
            const rem = shuffledTeams.length - sizeA
            const sizeB = Math.ceil(rem / 2)

            const groupA = shuffledTeams.slice(0, sizeA)
            const groupB = shuffledTeams.slice(sizeA, sizeA + sizeB)
            const groupC = shuffledTeams.slice(sizeA + sizeB)

            inserts.push(...groupA.map(tid => ({ cup_id: currentCupId, team_id: tid, group_name: 'A' })))
            inserts.push(...groupB.map(tid => ({ cup_id: currentCupId, team_id: tid, group_name: 'B' })))
            inserts.push(...groupC.map(tid => ({ cup_id: currentCupId, team_id: tid, group_name: 'C' })))
        } else {
            // 2 Groups (A, B)
            const halfSize = Math.ceil(shuffledTeams.length / 2)
            const groupA = shuffledTeams.slice(0, halfSize)
            const groupB = shuffledTeams.slice(halfSize)

            inserts.push(...groupA.map(tid => ({ cup_id: currentCupId, team_id: tid, group_name: 'A' })))
            inserts.push(...groupB.map(tid => ({ cup_id: currentCupId, team_id: tid, group_name: 'B' })))
        }

        await supabase.from('doubles_cup_teams').delete().eq('cup_id', currentCupId)

        const { error } = await supabase.from('doubles_cup_teams').insert(inserts)
        if (error) {
            alert("Error in draw: " + error.message)
            return
        }

        if (cup?.status === 'setup') {
            await supabase.from('doubles_cups').update({ status: 'groups' }).eq('id', currentCupId)
        }

        fetchInitialData()
    }

    async function setFinalsMode(mode: string) {
        if (!cup) return
        const { error } = await supabase
            .from('doubles_cups')
            .update({ finals_mode: mode, status: 'finals' })
            .eq('id', cup.id)
        if (error) alert(error.message)
        else fetchInitialData()
    }

    async function finishCup(winnerTeamId: string | null) {
        if (!cup) return

        if (!winnerTeamId) {
            setCup(null)
            setCupTeams([])
            setCupMatches([])
            setSelectedPlayerIds(new Set(players.map(p => p.id)))
            viewingFinishedRef.current = false
            return
        }

        if (cup) {
            setCup({ ...cup, status: 'finished', winner_team_id: winnerTeamId })
            viewingFinishedRef.current = true
        }

        const { error } = await supabase
            .from('doubles_cups')
            .update({ status: 'finished', winner_team_id: winnerTeamId })
            .eq('id', cup.id)

        if (error) {
            alert(error.message)
            return
        }

        await supabase.rpc('increment_doubles_cup_wins', { p_team_id: winnerTeamId })
    }

    async function reportMatch(winnerId: string, loserId: string, phase: string) {
        if (!cup) return

        const { error } = await supabase
            .from('doubles_matches')
            .insert([{
                winner_team_id: winnerId,
                loser_team_id: loserId,
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
        const { error } = await supabase.rpc('undo_last_doubles_match', { p_match_id: matchId })
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
                        <Users size={40} className="text-blue-500" /> Copa de Parejas (Sorteo Nivelado)
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                    <div className="bg-neutral-900/50 rounded-[2rem] border border-green-500/20 p-6 flex flex-col min-h-0 shadow-xl">
                        <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-3"><CheckCircle2 size={24} /> Inscritos ({included.length})</span>
                            {selectedPlayerIds.size % 2 !== 0 && (
                                <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/50">Impar</span>
                            )}
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-2">
                            {included.map(p => (
                                <motion.button
                                    layout
                                    key={p.id}
                                    onClick={() => togglePlayer(p.id)}
                                    className="w-full flex justify-between items-center p-3 bg-neutral-800/50 hover:bg-neutral-700/50 rounded-xl border border-neutral-700 transition-all group"
                                >
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="text-lg font-bold text-white uppercase">{p.name}</span>
                                        <span className="text-[10px] text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded-full block">WR: {(playerStats[p.id]?.winPct * 100 || 0).toFixed(0)}%</span>
                                    </div>
                                    <ChevronRight className="text-neutral-600 group-hover:text-green-500 transition-colors" />
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-neutral-900/50 rounded-[2rem] border border-red-500/20 p-6 flex flex-col min-h-0 shadow-xl">
                        <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-3">
                            <AlertCircle size={24} /> Fuera de Pista ({excluded.length})
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
                        disabled={selectedPlayerIds.size < 4 || selectedPlayerIds.size % 2 !== 0}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:grayscale text-white px-12 py-6 rounded-3xl font-black text-2xl uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4"
                    >
                        <Play fill="currentColor" /> {selectedPlayerIds.size % 2 !== 0 ? 'Jugadores Impares' : 'Mezclar y Sortear'}
                    </button>
                </div>
            </div>
        )
    }

    // --- GROUPS & FINALS VIEW ---
    if (cup.status === 'groups' || cup.status === 'finals' || cup.status === 'finished') {
        const groupAEntities = cupTeams.filter(cp => cp.group_name === 'A')
        const groupBEntities = cupTeams.filter(cp => cp.group_name === 'B')
        const groupCEntities = cupTeams.filter(cp => cp.group_name === 'C')

        const hasGroupC = groupCEntities.length > 0

        const calcStandings = (teams: DoublesCupTeam[], groupMatches: any[]) => {
            return teams.map(t => {
                const wins = groupMatches.filter(m => m.winner_team_id === t.team_id).length
                const losses = groupMatches.filter(m => m.loser_team_id === t.team_id).length
                return { ...t, wins, losses }
            }).sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins
                return a.losses - b.losses
            })
        }

        const standingsA = calcStandings(groupAEntities, cupMatches.filter(m => m.cup_phase === 'group_A'))
        const standingsB = calcStandings(groupBEntities, cupMatches.filter(m => m.cup_phase === 'group_B'))
        const standingsC = calcStandings(groupCEntities, cupMatches.filter(m => m.cup_phase === 'group_C'))

        const allGroupsFinished =
            standingsA.length >= 2 && standingsB.length >= 2 &&
            (!hasGroupC || standingsC.length >= 2) &&
            (cupMatches.filter(m => m.cup_phase === 'group_A').length >= (standingsA.length * (standingsA.length - 1)) / 2) &&
            (cupMatches.filter(m => m.cup_phase === 'group_B').length >= (standingsB.length * (standingsB.length - 1)) / 2) &&
            (!hasGroupC || (cupMatches.filter(m => m.cup_phase === 'group_C').length >= (standingsC.length * (standingsC.length - 1)) / 2))

        return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full p-4 overflow-hidden">
                <div className={clsx("col-span-1 md:col-span-9 grid gap-8 min-h-0", hasGroupC ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2")}>
                    <GroupCard
                        name="Grupo A"
                        teams={groupAEntities}
                        matches={cupMatches.filter(m => m.cup_phase === 'group_A')}
                        playerStats={playerStats}
                        onReport={(w: string, l: string) => reportMatch(w, l, 'group_A')}
                        onUndo={undoMatch}
                    />
                    <GroupCard
                        name="Grupo B"
                        teams={groupBEntities}
                        matches={cupMatches.filter(m => m.cup_phase === 'group_B')}
                        playerStats={playerStats}
                        onReport={(w: string, l: string) => reportMatch(w, l, 'group_B')}
                        onUndo={undoMatch}
                    />
                    {hasGroupC && (
                        <GroupCard
                            name="Grupo C"
                            teams={groupCEntities}
                            matches={cupMatches.filter(m => m.cup_phase === 'group_C')}
                            playerStats={playerStats}
                            onReport={(w: string, l: string) => reportMatch(w, l, 'group_C')}
                            onUndo={undoMatch}
                        />
                    )}
                </div>

                <div className="col-span-1 md:col-span-3 flex flex-col gap-8 min-h-0">
                    <FinalPhaseCard
                        cup={cup}
                        standingsA={standingsA}
                        standingsB={standingsB}
                        standingsC={standingsC}
                        hasGroupC={hasGroupC}
                        matches={cupMatches}
                        active={allGroupsFinished || cup.status === 'finals' || cup.status === 'finished'}
                        onSetMode={setFinalsMode}
                        onReport={reportMatch}
                        onFinish={finishCup}
                        onUndo={undoMatch}
                    />
                </div>

                {cup.status === 'finished' && !victoryDismissed && <VictoryModal cup={cup} teams={cupTeams} onClose={(reset: boolean) => reset ? finishCup(null) : setVictoryDismissed(true)} />}
            </div>
        )
    }

    return null
}

function GroupCard({ name, teams, matches, playerStats, onReport, onUndo }: any) {
    const possibleMatches: [string, string][] = []
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            possibleMatches.push([teams[i].team_id, teams[j].team_id])
        }
    }

    const standings = teams.map((t: any) => {
        const wins = matches.filter((m: any) => m.winner_team_id === t.team_id).length
        const losses = matches.filter((m: any) => m.loser_team_id === t.team_id).length
        return { ...t, wins, losses }
    }).sort((a: any, b: any) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return a.losses - b.losses
    })

    return (
        <div className="flex flex-col min-h-0 bg-neutral-900/50 rounded-[3rem] border border-neutral-800 p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-2xl font-black text-white mb-6 uppercase italic tracking-tighter">{name}</h3>

            <div className="flex-1 flex flex-col gap-6 min-h-0">
                <div className="bg-neutral-800/30 rounded-3xl p-4 min-h-[200px]">
                    <div className="grid grid-cols-12 text-xs font-black text-neutral-500 uppercase tracking-widest px-4 mb-2">
                        <div className="col-span-2">#</div>
                        <div className="col-span-7">Equipo</div>
                        <div className="col-span-1 flex justify-center">W</div>
                        <div className="col-span-2 flex justify-center">L</div>
                    </div>
                    <div className="space-y-1">
                        {standings.map((t: any, i: number) => {
                            const p1_wr = (playerStats?.[t.team?.player1_id]?.winPct * 100 || 0).toFixed(1)
                            const p2_wr = (playerStats?.[t.team?.player2_id]?.winPct * 100 || 0).toFixed(1)
                            const avg_wr = ((parseFloat(p1_wr) + parseFloat(p2_wr)) / 2).toFixed(1)

                            return (
                                <div key={t.team_id} className="grid grid-cols-12 items-center p-3 rounded-xl bg-neutral-800/40 border border-neutral-700/50 text-xl">
                                    <div className="col-span-2 font-mono text-neutral-500">#{i + 1}</div>
                                    <div className="col-span-7 flex flex-col justify-center min-w-0">
                                        <div className="font-bold text-white truncate text-base">{t.team?.name?.replace(' & ', ' ♥ ')}</div>
                                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate">
                                            ({p2_wr}%) • ({p1_wr}%) <span className="ml-1 text-blue-400">AVG: {avg_wr}%</span>
                                        </div>
                                    </div>
                                    <div className="col-span-1 flex justify-center font-bold text-green-500">{t.wins}</div>
                                    <div className="col-span-2 flex justify-center font-bold text-red-500">{t.losses}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                    <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                        <Play size={14} fill="currentColor" /> Partidos
                    </h4>

                    <div className="space-y-2 flex flex-col">
                        {possibleMatches.map(([t1Id, t2Id]) => {
                            const t1 = teams.find((t: any) => t.team_id === t1Id)?.team
                            const t2 = teams.find((t: any) => t.team_id === t2Id)?.team
                            const match = matches.find((m: any) =>
                                (m.winner_team_id === t1Id && m.loser_team_id === t2Id) ||
                                (m.winner_team_id === t2Id && m.loser_team_id === t1Id)
                            )

                            if (!t1 || !t2) return null

                            return (
                                <div key={`${t1Id}-${t2Id}`} className={clsx(
                                    "p-4 rounded-2xl border transition-all flex flex-col gap-2",
                                    match ? "bg-neutral-800/20 border-neutral-800 opacity-60" : "bg-neutral-800/60 border-neutral-700 hover:border-blue-500/50"
                                )}>
                                    <div className="flex flex-col gap-2 flex-1">
                                        <button
                                            disabled={!!match}
                                            onClick={() => onReport(t1Id, t2Id)}
                                            className={clsx(
                                                "w-full text-center font-bold text-sm md:text-base py-2 px-1 rounded-xl transition-all truncate",
                                                match?.winner_team_id === t1Id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-neutral-700/30 hover:bg-white/5 text-neutral-300"
                                            )}
                                        >
                                            {t1.name?.replace(' & ', ' ♥ ')}
                                        </button>
                                        <span className="text-neutral-600 font-black italic text-center w-full text-xs">VS</span>
                                        <button
                                            disabled={!!match}
                                            onClick={() => onReport(t2Id, t1Id)}
                                            className={clsx(
                                                "w-full text-center font-bold text-sm md:text-base py-2 px-1 rounded-xl transition-all truncate",
                                                match?.winner_team_id === t2Id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-neutral-700/30 hover:bg-white/5 text-neutral-300"
                                            )}
                                        >
                                            {t2.name?.replace(' & ', ' ♥ ')}
                                        </button>
                                    </div>
                                    {match && (
                                        <button onClick={() => onUndo(match.id)} className="w-full text-center mt-2 pt-2 border-t border-neutral-800 text-neutral-600 hover:text-orange-500 transition-colors text-xs flex justify-center items-center gap-1">
                                            <Undo2 size={12} /> Deshacer
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

function FinalPhaseCard({ cup, standingsA, standingsB, standingsC, hasGroupC, matches, active, onSetMode, onReport, onFinish, onUndo }: any) {
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
                <h3 className="text-2xl font-black text-white mb-6 uppercase italic tracking-tighter text-center">Configurar Finales Parejas</h3>
                <div className="space-y-4">
                    <button onClick={() => onSetMode('semi_final_final')} className="w-full p-6 bg-blue-600/20 border border-blue-500/50 rounded-2xl hover:bg-blue-600/40 transition-all font-bold text-lg">Semifinales y Final</button>
                    {!hasGroupC && (
                        <button onClick={() => onSetMode('third_fourth_semi_final')} className="w-full p-6 bg-blue-600/20 border border-blue-500/50 rounded-2xl hover:bg-blue-600/40 transition-all font-bold text-lg">3º/4º puesto + Semis</button>
                    )}
                    <button onClick={() => onSetMode('only_final')} className="w-full p-6 bg-blue-600/20 border border-blue-500/50 rounded-2xl hover:bg-blue-600/40 transition-all font-bold text-lg">Solo FINAL</button>
                </div>
            </div>
        )
    }

    const finalsMatches = matches.filter((m: any) => ['semi_1', 'semi_2', 'final', 'third_fourth'].includes(m.cup_phase))

    let semi1: any, semi2: any
    if (hasGroupC) {
        const winners = [standingsA[0], standingsB[0], standingsC[0]].filter(Boolean)
        const runnersUp = [standingsA[1], standingsB[1], standingsC[1]].filter(Boolean)

        const bestSecond = runnersUp.sort((a, b) => b.wins - a.wins)[0]
        const sortedWinners = winners.sort((a, b) => b.wins - a.wins)

        semi1 = { p1: sortedWinners[0], p2: bestSecond, phase: 'semi_1' }
        semi2 = { p1: sortedWinners[1], p2: sortedWinners[2], phase: 'semi_2' }
    } else {
        semi1 = { p1: standingsA[0], p2: standingsB[1], phase: 'semi_1' }
        semi2 = { p1: standingsB[0], p2: standingsA[1], phase: 'semi_2' }
    }

    const mS1 = finalsMatches.find((m: any) => m.cup_phase === 'semi_1')
    const mS2 = finalsMatches.find((m: any) => m.cup_phase === 'semi_2')

    let finalP1: any, finalP2: any
    if (cup.finals_mode === 'only_final') {
        if (hasGroupC) {
            const top2Obs = [standingsA[0], standingsB[0], standingsC[0]].sort((a, b) => b.wins - a.wins)
            finalP1 = top2Obs[0]
            finalP2 = top2Obs[1]
        } else {
            finalP1 = standingsA[0]
            finalP2 = standingsB[0]
        }
    } else {
        finalP1 = mS1 ? (mS1.winner_team_id === semi1.p1.team_id ? semi1.p1 : semi1.p2) : null
        finalP2 = mS2 ? (mS2.winner_team_id === semi2.p1.team_id ? semi2.p1 : semi2.p2) : null
    }

    const mF = finalsMatches.find((m: any) => m.cup_phase === 'final')

    let t4P1: any, t4P2: any
    if (mS1 && mS2 && cup.finals_mode === 'third_fourth_semi_final') {
        t4P1 = mS1.winner_team_id === semi1.p1.team_id ? semi1.p2 : semi1.p1
        t4P2 = mS2.winner_team_id === semi2.p1.team_id ? semi2.p2 : semi2.p1
    }
    const mT4 = finalsMatches.find((m: any) => m.cup_phase === 'third_fourth')

    return (
        <div className="flex-1 bg-neutral-900/80 rounded-[2.5rem] border border-blue-500/20 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <h3 className="text-xl font-black text-blue-400 uppercase tracking-widest text-center border-b border-blue-500/20 pb-4">Fase Eliminatoria Parejas</h3>

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
        </div>
    )
}

function EliminationMatch({ title, p1, p2, match, highlight, onReport, onUndo, onFinish }: any) {
    if (!p1 || !p2) return (
        <div className="p-4 bg-neutral-800/20 rounded-2xl border border-neutral-800/50 opacity-40">
            <div className="text-[10px] font-black uppercase text-neutral-600 mb-2">{title}</div>
            <div className="text-center italic text-neutral-700">Esperando equipos...</div>
        </div>
    )

    return (
        <div className={clsx(
            "p-5 rounded-3xl border transition-all flex flex-col gap-3",
            highlight ? "bg-gradient-to-br from-yellow-900/30 to-black/60 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)]" : "bg-neutral-800/40 border-neutral-700"
        )}>
            <div className={clsx("text-xs font-black uppercase tracking-widest", highlight ? "text-yellow-500" : "text-neutral-500")}>{title}</div>
            <div className="flex flex-col gap-2">
                <button
                    disabled={!!match}
                    onClick={() => onReport(p1.team_id, p2.team_id)}
                    className={clsx(
                        "w-full py-3 px-2 rounded-2xl font-bold text-sm md:text-base transition-all truncate",
                        match?.winner_team_id === p1.team_id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-neutral-700/50 hover:bg-neutral-600 text-neutral-300"
                    )}
                >
                    {p1.team?.name?.replace(' & ', ' ♥ ')}
                </button>
                <span className="font-black italic text-neutral-600 px-1 text-center w-full text-xs">VS</span>
                <button
                    disabled={!!match}
                    onClick={() => onReport(p2.team_id, p1.team_id)}
                    className={clsx(
                        "w-full py-3 px-2 rounded-2xl font-bold text-sm md:text-base transition-all truncate",
                        match?.winner_team_id === p2.team_id ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-neutral-700/50 hover:bg-neutral-600 text-neutral-300"
                    )}
                >
                    {p2.team?.name?.replace(' & ', ' ♥ ')}
                </button>
            </div>
            {match && (
                <div className="flex justify-between items-center mt-1">
                    <button onClick={() => onUndo(match.id)} className="text-neutral-600 hover:text-orange-500 text-xs flex items-center gap-1">
                        <Undo2 size={12} /> Deshacer
                    </button>
                    {highlight && onFinish && (
                        <button
                            onClick={() => onFinish(match.winner_team_id)}
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

function VictoryModal({ cup, teams, onClose }: any) {
    const winner = teams.find((t: any) => t.team_id === cup.winner_team_id)?.team
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
                    <button onClick={() => onClose(false)} className="absolute top-6 right-6 text-neutral-500 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 p-3 rounded-full transition-colors"><X size={24} /></button>

                    <motion.div animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="mb-8 flex justify-center">
                        <Trophy size={120} className="text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />
                    </motion.div>

                    <h2 className="text-2xl md:text-3xl font-bold text-yellow-500 uppercase tracking-[0.2em] mb-4">Campeones {cup.name}</h2>
                    <h1 className="text-5xl md:text-7xl font-black text-white uppercase italic tracking-tighter mb-8 glow-text">
                        {winner.name?.replace(' & ', ' ♥ ')}
                    </h1>

                    <button onClick={() => onClose(true)} className="bg-white text-black px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-xl hover:bg-neutral-200 transition-all transform hover:scale-110 active:scale-95 shadow-2xl">
                        Continuar
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
