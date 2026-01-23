import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import PlayerStats from './pages/PlayerStats'
import { SpeedInsights } from "@vercel/speed-insights/react"

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-neutral-900 text-white font-sans">
        <SpeedInsights />
        {/* Navigation for Mobile/Testing - REMOVED (Pages handle their own) */}


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
