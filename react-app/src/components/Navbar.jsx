import { useState } from 'react'
import '../styles/Navbar.css'

/**
 * Navbar Component
 * Shared across all React pages
 * Mobile-responsive hamburger menu
 */
function Navbar({ user, setUser }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleMenu = () => setMenuOpen(!menuOpen)

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-social">
          <a href="#" className="social-icon"><i className="fab fa-instagram"></i></a>
          <a href="#" className="social-icon"><i className="fab fa-tiktok"></i></a>
        </div>

        <div className="nav-logo">
          <span>RoastMyDorm</span>
        </div>

        <div className={`nav-menu ${menuOpen ? 'active' : ''}`} id="navMenu">
          <a href="/" className="nav-link">
            <i className="fas fa-home"></i>
            Home
          </a>
          <a href="/chat-support" className="nav-link">
            <i className="fas fa-comments"></i>
            Chat Support
          </a>
          <a href="/dorm-listing" className="nav-link">
            <i className="fas fa-building"></i>
            Browse Dorms
          </a>
          <button className="nav-btn">Sign In</button>
        </div>

        <div 
          className={`hamburger ${menuOpen ? 'active' : ''}`} 
          onClick={toggleMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
