# 🔌 API Integration Guide

This guide explains how to connect React components to your backend API.

---

## Current Setup (Fake Data)

Right now, all components use fake data:

```jsx
const allDorms = [
  { id: 1, name: "Dorm A", price: 2500, ... },
  // ... more fake dorms
]
```

---

## Step 1: Set Up API Base URL

Create `src/api.js`:
```javascript
const API_BASE = 'http://localhost:5000/api'  // Your backend URL

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`
  
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })
    
    if (!response.ok) throw new Error(`API Error: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}
```

---

## Step 2: Update Components

### Chat Messages - Load from API

**Current code in `ChatSupport.jsx`:**
```jsx
const [messages, setMessages] = useState([
  { id: 1, type: 'support', text: 'Hi there! 👋' }
])
```

**New code with API:**
```jsx
import { useEffect } from 'react'
import { apiCall } from '../api'

function ChatSupport() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  // Load messages when page opens
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await apiCall('/messages')
        setMessages(data)
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadMessages()
  }, [])

  if (loading) return <div>Loading...</div>

  // ... rest of component
}
```

### Send Message to Backend

**Current code:**
```jsx
const handleSendMessage = (e) => {
  e.preventDefault()
  const userMessage = {
    id: messages.length + 1,
    type: 'user',
    text: input
  }
  setMessages([...messages, userMessage])
  // ... simulates response
}
```

**New code:**
```jsx
const handleSendMessage = async (e) => {
  e.preventDefault()
  
  if (!input.trim()) return

  // Add user message locally
  const userMessage = {
    id: messages.length + 1,
    type: 'user',
    text: input
  }
  setMessages([...messages, userMessage])
  setInput('')

  // Send to backend
  try {
    const response = await apiCall('/messages', {
      method: 'POST',
      body: { text: input }
    })
    
    // Add support response
    const supportMessage = {
      ...response,
      type: 'support'
    }
    setMessages(prev => [...prev, supportMessage])
  } catch (error) {
    console.error('Failed to send message:', error)
    alert('Failed to send message. Please try again.')
  }
}
```

### Dorm Listing - Load from API

**Current code in `DormListing.jsx`:**
```jsx
const allDorms = [
  { id: 1, name: "Cozy Room", ... },
  // ... hard-coded dorms
]
```

**New code:**
```jsx
import { useEffect } from 'react'
import { apiCall } from '../api'

function DormListing() {
  const [allDorms, setAllDorms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load dorms when page opens
  useEffect(() => {
    const loadDorms = async () => {
      try {
        const data = await apiCall('/dorms')
        setAllDorms(data)
      } catch (err) {
        setError('Failed to load dorms')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadDorms()
  }, [])

  if (loading) return <div className="loading">Loading dorms...</div>
  if (error) return <div className="error">{error}</div>

  // ... rest of component uses allDorms
}
```

### User Dashboard - Load Profile

**Current code in `UserDashboard.jsx`:**
```jsx
const [profile, setProfile] = useState({
  name: 'Ahmed Mohammed',
  email: 'ahmed@example.com',
  // ... fake data
})
```

**New code:**
```jsx
useEffect(() => {
  const loadProfile = async () => {
    try {
      const data = await apiCall('/user/profile')
      setProfile(data)
    } catch (error) {
      console.error('Failed to load profile:', error)
    }
  }
  
  loadProfile()
}, [])

// Update profile
const handleProfileUpdate = async (e) => {
  e.preventDefault()
  
  try {
    const response = await apiCall('/user/profile', {
      method: 'PUT',
      body: profile
    })
    
    setProfile(response)
    alert('Profile updated successfully!')
  } catch (error) {
    console.error('Failed to update profile:', error)
    alert('Failed to update profile')
  }
}
```

---

## Step 3: Expected Backend API Endpoints

Your backend should have these routes:

### Chat Messages
```
GET  /api/messages              → Get all messages
POST /api/messages              → Send new message
GET  /api/messages/:id          → Get specific message
DELETE /api/messages/:id        → Delete message
```

### Dorms
```
GET    /api/dorms               → Get all dorms
GET    /api/dorms/:id           → Get specific dorm
POST   /api/dorms               → Create new dorm (admin)
PUT    /api/dorms/:id           → Update dorm (admin)
DELETE /api/dorms/:id           → Delete dorm (admin)
GET    /api/dorms/search?q=city → Search dorms
```

### User Profile
```
GET    /api/user/profile        → Get current user profile
PUT    /api/user/profile        → Update user profile
GET    /api/user/saved-dorms    → Get user's saved dorms
POST   /api/user/save-dorm/:id  → Save dorm
DELETE /api/user/save-dorm/:id  → Unsave dorm
GET    /api/user/reviews        → Get user's reviews
POST   /api/user/reviews        → Create review
PUT    /api/user/reviews/:id    → Update review
DELETE /api/user/reviews/:id    → Delete review
```

---

## Step 4: Authentication (When Ready)

Add JWT token handling:

```jsx
// src/api.js - updated
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`
  const token = localStorage.getItem('authToken')  // Get stored token

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  // Add auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  // Handle 401 Unauthorized
  if (response.status === 401) {
    localStorage.removeItem('authToken')
    window.location.href = '/login'
  }

  if (!response.ok) throw new Error(`API Error: ${response.status}`)
  return await response.json()
}
```

---

## Step 5: Error Handling

```jsx
// Good error handling pattern
try {
  const data = await apiCall('/endpoint')
  // Success - use data
} catch (error) {
  console.error('API Error:', error)
  setError('Failed to load data. Please try again.')
}
```

---

## Testing API Calls

Use Postman or curl to test endpoints:

```bash
# Test GET
curl http://localhost:5000/api/dorms

# Test POST
curl -X POST http://localhost:5000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello"}'
```

---

## Loading States

Always show loading indicator:

```jsx
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)

// Show loading
<div>{loading ? 'Loading...' : 'Content here'}</div>

// Show error
{error && <div className="error-message">{error}</div>}
```

---

## Real-Time Features (WebSockets)

For live chat, install WebSocket library:

```bash
npm install socket.io-client
```

Connect to WebSocket:

```jsx
import { useEffect } from 'react'
import io from 'socket.io-client'

function ChatSupport() {
  const socket = io('http://localhost:5000')

  useEffect(() => {
    // Listen for messages
    socket.on('message', (msg) => {
      setMessages(prev => [...prev, msg])
    })

    return () => socket.disconnect()
  }, [])

  const sendMessage = (text) => {
    socket.emit('message', { text, timestamp: Date.now() })
  }
}
```

---

## Environment Variables

Create `.env` file:
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Use in code:
```jsx
const API_BASE = import.meta.env.VITE_API_URL
```

---

## Common Issues

### CORS Error
**Problem:** "Access to XMLHttpRequest blocked by CORS policy"

**Solution:** Configure CORS on backend:
```javascript
// Node.js/Express example
const cors = require('cors')
app.use(cors({
  origin: 'http://localhost:3000'
}))
```

### 404 Errors
- Check backend is running
- Check API URL is correct
- Check endpoint path matches

### Slow Loading
- Add loading indicators
- Use pagination for large lists
- Cache data with useMemo

---

## Next Steps

1. Build backend API endpoints
2. Update components with API calls
3. Test with Postman
4. Add error handling
5. Implement real-time features

---

**Questions?** Check your backend documentation or ask in team chat!
