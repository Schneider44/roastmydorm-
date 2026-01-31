# RoastMyDorm React App - Beginner's Guide

## 📱 Project Overview

This is a **React + Vite** application for the RoastMyDorm platform. We're building only the interactive features in React (Chat, Dorm Listing, User Dashboard), while keeping static pages (Home, How It Works) as HTML.

### What's in React:
- ✅ **Chat Support** - Live chat with FAQs
- ✅ **Dorm Listing** - Browse & filter dormitories
- ✅ **User Dashboard** - Profile, saved dorms, reviews
- ✅ **Real-time Features** - Ready for WebSocket integration

### What's Still HTML:
- 📄 Home page (index.html)
- 📄 How It Works
- 📄 Static landing pages

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd react-app
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
This will open the app at `http://localhost:3000`

### 3. Build for Production
```bash
npm run build
```
Creates optimized files in `dist/` folder

---

## 📁 Project Structure

```
react-app/
├── src/
│   ├── components/          # Reusable components
│   │   └── Navbar.jsx       # Navigation bar
│   │
│   ├── pages/               # Full page components
│   │   ├── ChatSupport.jsx  # Chat support page
│   │   ├── DormListing.jsx  # Dorm browsing & filtering
│   │   └── UserDashboard.jsx # User profile & settings
│   │
│   ├── styles/              # CSS files
│   │   ├── index.css        # Global styles
│   │   ├── Navbar.css
│   │   ├── ChatSupport.css
│   │   ├── DormListing.css
│   │   └── UserDashboard.css
│   │
│   ├── App.jsx              # Main app with routing
│   └── main.jsx             # Entry point
│
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.js          # Vite configuration
└── README.md               # This file
```

---

## 🎓 React Concepts for Beginners

### 1. **Components** (Building Blocks)
Components are functions that return HTML. Think of them as reusable pieces of UI.

```jsx
function MyButton() {
  return <button>Click me</button>
}
```

### 2. **JSX** (HTML in JavaScript)
You can write HTML-like code in JavaScript:

```jsx
const name = "Ahmed"
return <h1>Hello {name}!</h1>  // Shows "Hello Ahmed!"
```

### 3. **State** (Component Memory)
Use `useState` to remember things in your component:

```jsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)  // count = 0 initially
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

### 4. **Props** (Pass Data to Components)
Components receive data as "props":

```jsx
function Greeting({ name }) {
  return <h1>Hello {name}!</h1>
}

// Use it like:
<Greeting name="Ahmed" />
```

### 5. **Rendering Lists** (map)
Display many items with `.map()`:

```jsx
const dorms = ['Dorm A', 'Dorm B', 'Dorm C']

return (
  <ul>
    {dorms.map(dorm => <li key={dorm}>{dorm}</li>)}
  </ul>
)
```

---

## 📝 Key Files Explained

### **App.jsx** - Main Application
Controls routing between pages. Routes map URLs to components:
- `/chat-support` → ChatSupport page
- `/dorm-listing` → DormListing page
- `/dashboard` → UserDashboard page

### **Navbar.jsx** - Navigation Bar
- Responsive hamburger menu on mobile
- Mobile menu opens/closes with `toggleMobileMenu()`
- Shows navigation links and Sign In button

### **ChatSupport.jsx** - Chat Page
- Messages state tracks conversation
- `handleSendMessage()` sends new messages
- Simulates support responses after 800ms
- FAQ section with expandable questions

### **DormListing.jsx** - Dorm Browser
- `allDorms` array has sample data
- `useState` for: selectedCity, priceRange, sortBy
- `useMemo` filters & sorts dorms efficiently
- Grid layout that's responsive

### **UserDashboard.jsx** - User Profile
- Multiple tabs: profile, saved, reviews, settings
- Form for editing profile
- Display lists of saved dorms and reviews
- Settings panel for preferences

---

## 🔌 Connecting to Backend API

When you're ready to connect to a real backend:

### 1. **Chat Messages** - Replace with API:
```jsx
// Old (fake data):
const [messages, setMessages] = useState([...])

// New (with API):
useEffect(() => {
  fetch('/api/messages')
    .then(res => res.json())
    .then(data => setMessages(data))
}, [])
```

### 2. **Dorm Data** - Fetch from API:
```jsx
useEffect(() => {
  fetch('/api/dorms')
    .then(res => res.json())
    .then(data => setAllDorms(data))
}, [])
```

### 3. **User Profile** - Load from API:
```jsx
useEffect(() => {
  fetch('/api/user/profile')
    .then(res => res.json())
    .then(data => setProfile(data))
}, [])
```

---

## 🎨 Styling Tips

### **Responsive Design**
All pages use mobile-first design:
- Mobile (480px and below)
- Tablet (768px and below)
- Desktop (1024px and above)

### **CSS Classes**
Use Tailwind-style class naming:
- `.component-name` for main container
- `.component-child` for children
- `.is-active` for state

Example:
```css
.chat-message { /* main */ }
.chat-message.user { /* variation */ }
.chat-avatar { /* child */ }
```

### **Colors**
Use CSS variables defined in `index.css`:
```css
background: var(--navy-blue);
color: var(--red);
```

---

## 🐛 Common Issues & Solutions

### Issue: Navbar menu doesn't work
**Solution:** Check that `toggleMobileMenu()` function is called in hamburger `onClick`

### Issue: Styles not applying
**Solution:** 
1. Check CSS file is imported in component
2. Check class names match in HTML and CSS
3. Check media queries are correct

### Issue: Component not showing
**Solution:**
1. Check route exists in App.jsx
2. Check component is exported with `export default`
3. Check imports are correct

---

## 📚 Learning Resources

### React Basics
- [React Official Docs](https://react.dev)
- [React Hooks Guide](https://react.dev/reference/react)
- [JSX Syntax](https://react.dev/learn/writing-markup-with-jsx)

### Vite
- [Vite Getting Started](https://vitejs.dev/guide/)
- [Vite + React](https://vitejs.dev/guide/#trying-vite-online)

### CSS
- [MDN CSS Guide](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [Mobile-First Design](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries)

---

## 🚀 Next Steps

### Phase 1: Connect to Backend
1. Replace fake data with API calls
2. Add real chat using WebSockets
3. Implement user authentication

### Phase 2: Add Features
1. Real-time notifications
2. Image uploads for dorm listings
3. Landlord messaging system
4. Review ratings system

### Phase 3: Optimization
1. Code splitting for faster loading
2. Image optimization
3. PWA (Progressive Web App) setup
4. Analytics integration

---

## ❓ Questions?

### For your team:
1. **How do I add a new page?**
   - Create component in `/pages`
   - Add route in `App.jsx`
   - Create CSS file
   - Link in Navbar

2. **How do I add a new component?**
   - Create component in `/components`
   - Export it: `export default MyComponent`
   - Import in parent component
   - Add props as needed

3. **How do I style mobile vs desktop?**
   - Use `@media (max-width: 768px)` for mobile
   - Put mobile styles after desktop styles
   - Test with browser DevTools device emulation

---

## 📞 Support

For questions about React, Vite, or deployment:
- Check comments in code files
- Visit React documentation
- Ask in team chat

Good luck! 🎉
