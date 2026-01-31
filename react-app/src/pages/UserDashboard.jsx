import { useState } from 'react'
import '../styles/UserDashboard.css'

/**
 * UserDashboard Component
 * User profile, saved dorms, reviews, and settings
 */
function UserDashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState({
    name: 'Ahmed Mohammed',
    email: 'ahmed@example.com',
    phone: '+212 6 12 345 678',
    university: 'Hassan II University',
    city: 'Casablanca',
    joinDate: 'January 2024'
  })

  const [savedDorms] = useState([
    { id: 1, name: 'Cozy Room - Ain Sebaa', city: 'Casablanca', price: 2500, rating: 4.5 },
    { id: 2, name: 'Modern Apartment - Hassan II', city: 'Casablanca', price: 3000, rating: 4.8 }
  ])

  const [reviews] = useState([
    { 
      id: 1, 
      dormName: 'Cozy Room - Ain Sebaa',
      rating: 4,
      text: 'Great location and clean facilities!',
      date: 'Jan 15, 2024'
    },
    { 
      id: 2, 
      dormName: 'Student Residence - Rabat',
      rating: 5,
      text: 'Amazing experience, would recommend to all students!',
      date: 'Dec 28, 2023'
    }
  ])

  const handleProfileUpdate = (e) => {
    e.preventDefault()
    alert('Profile updated successfully!')
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Your Dashboard</h1>
        <p>Manage your profile, saved dorms, and reviews</p>
      </div>

      <div className="dashboard-content">
        {/* Sidebar Navigation */}
        <aside className="dashboard-sidebar">
          <div className="user-card">
            <div className="user-avatar">A</div>
            <h3>{profile.name}</h3>
            <p>{profile.email}</p>
          </div>

          <nav className="dashboard-nav">
            <button 
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <i className="fas fa-user"></i> Profile
            </button>
            <button 
              className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <i className="fas fa-bookmark"></i> Saved Dorms
            </button>
            <button 
              className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              <i className="fas fa-star"></i> My Reviews
            </button>
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <i className="fas fa-cog"></i> Settings
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="tab-content">
              <h2>My Profile</h2>
              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      value={profile.name}
                      onChange={(e) => setProfile({...profile, name: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input 
                      type="email" 
                      value={profile.email}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input 
                      type="tel" 
                      value={profile.phone}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>University</label>
                    <input 
                      type="text" 
                      value={profile.university}
                      onChange={(e) => setProfile({...profile, university: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <select value={profile.city} onChange={(e) => setProfile({...profile, city: e.target.value})}>
                      <option>Casablanca</option>
                      <option>Rabat</option>
                      <option>Marrakech</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Member Since</label>
                    <input type="text" value={profile.joinDate} disabled />
                  </div>
                </div>

                <button type="submit" className="btn-primary">Save Changes</button>
              </form>
            </div>
          )}

          {/* Saved Dorms Tab */}
          {activeTab === 'saved' && (
            <div className="tab-content">
              <h2>Saved Dorms ({savedDorms.length})</h2>
              <div className="saved-dorms">
                {savedDorms.map(dorm => (
                  <div key={dorm.id} className="saved-dorm-card">
                    <div className="saved-dorm-info">
                      <h4>{dorm.name}</h4>
                      <p>{dorm.city}</p>
                      <div className="saved-dorm-footer">
                        <span className="price">{dorm.price} DH</span>
                        <span className="rating">⭐ {dorm.rating}</span>
                      </div>
                    </div>
                    <div className="saved-dorm-actions">
                      <button>View</button>
                      <button className="remove">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="tab-content">
              <h2>My Reviews ({reviews.length})</h2>
              <div className="reviews-list">
                {reviews.map(review => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <h4>{review.dormName}</h4>
                      <span className="review-date">{review.date}</span>
                    </div>
                    <div className="review-rating">
                      {'⭐'.repeat(review.rating)}
                    </div>
                    <p>{review.text}</p>
                    <div className="review-actions">
                      <button>Edit</button>
                      <button>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="tab-content">
              <h2>Settings</h2>
              <div className="settings-list">
                <div className="setting-item">
                  <h4>Email Notifications</h4>
                  <label>
                    <input type="checkbox" defaultChecked />
                    Receive updates about new dorm listings
                  </label>
                </div>
                <div className="setting-item">
                  <h4>Privacy</h4>
                  <label>
                    <input type="checkbox" defaultChecked />
                    Show my profile publicly
                  </label>
                </div>
                <div className="setting-item">
                  <h4>Danger Zone</h4>
                  <button className="btn-danger">Delete Account</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default UserDashboard
