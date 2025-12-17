import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Plus } from 'lucide-react'

export default function PlayerManager({ onPlayerAdded }: { onPlayerAdded: () => void }) {
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)

    async function addPlayer(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return
        setLoading(true)

        const { error } = await supabase.from('players').insert({ name: name.trim() })

        if (error) {
            alert('Error: ' + error.message)
        } else {
            setName('')
            onPlayerAdded()
        }
        setLoading(false)
    }

    return (
        <div className="mb-4 p-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase mb-2">Añadir Nuevo Jugador</h3>
            <form onSubmit={addPlayer} className="flex gap-2">
                <input
                    type="text"
                    placeholder="Nombre..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-400 outline-none"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <button
                    disabled={loading}
                    className="bg-neutral-700 hover:bg-white hover:text-black text-white p-2 rounded-lg transition-colors"
                >
                    <Plus size={20} />
                </button>
            </form>
        </div>
    )
}
