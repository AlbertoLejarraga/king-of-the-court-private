import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Trophy, PlusCircle, User, LayoutDashboard } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import PlayerStats from './pages/PlayerStats'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-neutral-900 text-white font-sans">
        {/* Navigation for Mobile/Testing */}
        <nav className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700 p-3 flex justify-around z-50 md:hidden">
          <Link to="/" className="flex flex-col items-center text-gray-400 hover:text-white">
            <LayoutDashboard size={20} />
            <span className="text-[10px] mt-1">Ranking</span>
          </Link>
          <Link to="/stats" className="flex flex-col items-center text-gray-400 hover:text-white">
            <User size={20} />
            <span className="text-[10px] mt-1">Stats</span>
          </Link>
        </nav>

        <main className="pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stats" element={<PlayerStats />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
