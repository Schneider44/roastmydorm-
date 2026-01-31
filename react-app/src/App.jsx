import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ChatSupport from './pages/ChatSupport'
import DormListing from './pages/DormListing'
import UserDashboard from './pages/UserDashboard'
import './App.css'

/**
 * Main App Component
 * Routes between different React pages
 * Keep existing HTML pages for static content
 */
function App() {
  const [user, setUser] = useState(null)

  return (
    <div className="app">
      <Navbar user={user} setUser={setUser} />
      
      <Routes>
        {/* React Pages */}
        <Route path="/chat-support" element={<ChatSupport />} />
        <Route path="/dorm-listing" element={<DormListing />} />
        <Route path="/dashboard" element={<UserDashboard user={user} setUser={setUser} />} />
        
        {/* Redirect old pages to React versions */}
        <Route path="/" element={<div>Loading...</div>} />
      </Routes>
    </div>
  )
}

export default App
