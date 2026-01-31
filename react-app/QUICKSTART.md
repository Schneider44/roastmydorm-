# 🚀 Quick Start Guide - RoastMyDorm React App

## First Time Setup (5 minutes)

### Step 1: Open Terminal
Navigate to the react-app folder:
```bash
cd c:\Users\user\ratemydorm\react-app
```

### Step 2: Install Dependencies
```bash
npm install
```
This downloads all required packages. Wait for it to finish (might take 1-2 minutes).

### Step 3: Start Development Server
```bash
npm run dev
```
You should see:
```
  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:3000/
  ➜  press h + enter to show help
```

### Step 4: Open in Browser
Click the link or go to: `http://localhost:3000`

You should see the RoastMyDorm app! 🎉

---

## Available Routes

- `http://localhost:3000/` - Home (will redirect to home page)
- `http://localhost:3000/chat-support` - Chat Support Page
- `http://localhost:3000/dorm-listing` - Browse Dorms
- `http://localhost:3000/dashboard` - User Dashboard

---

## Making Changes

### Editing a Component
1. Edit any `.jsx` file in `src/pages` or `src/components`
2. Save the file (Ctrl+S)
3. Page reloads automatically! ✨

Example: Edit `src/pages/ChatSupport.jsx`
```jsx
// Change this line:
<h1>RoastMyDorm Support Center</h1>

// To this:
<h1>Welcome to Support 👋</h1>
```

Save and see it update instantly!

### Editing Styles
1. Edit any `.css` file in `src/styles`
2. Save
3. Styles update automatically

---

## File Structure Quick Guide

```
📁 react-app
├── 📁 src                    ← Edit these files
│   ├── 📁 pages              ← Full pages
│   ├── 📁 components         ← Reusable UI pieces
│   ├── 📁 styles             ← CSS files
│   ├── App.jsx               ← Main app logic
│   └── main.jsx              ← Startup file
├── package.json              ← Dependencies list
└── README.md                 ← Full documentation
```

---

## Common Tasks

### 🎨 Change a Color
Edit `src/styles/index.css`:
```css
:root {
  --red: #dc2626;        ← Change red color
  --navy-blue: #1e3a8a;  ← Change navy
}
```

### ➕ Add a New Page
1. Create `src/pages/MyPage.jsx`:
```jsx
function MyPage() {
  return <h1>My New Page</h1>
}
export default MyPage
```

2. Add route in `src/App.jsx`:
```jsx
<Route path="/my-page" element={<MyPage />} />
```

3. Add link in `src/components/Navbar.jsx`:
```jsx
<a href="/my-page" className="nav-link">My Page</a>
```

### 🔄 Update Sample Data
Edit `src/pages/DormListing.jsx`:
```jsx
const allDorms = [
  { id: 1, name: "Your Dorm", city: "Your City", ... },
  // Add more here
]
```

---

## Troubleshooting

### Port 3000 Already in Use
```bash
# Windows - Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Then run `npm run dev` again.

### Dependencies Not Installing
```bash
# Clear cache and reinstall
rm -r node_modules package-lock.json
npm install
```

### Page Not Updating
- Press `Ctrl+Shift+R` for hard refresh
- Check browser console for errors (F12)

---

## Before Deploying

### Build for Production
```bash
npm run build
```
Creates `dist/` folder with optimized files.

### Upload to Server
Copy everything in `dist/` folder to your web server.

---

## 💡 Pro Tips

1. **Hot Module Replacement (HMR)** - Changes appear instantly
2. **React DevTools** - Install browser extension to debug components
3. **Console Errors** - Check browser console (F12) for helpful messages
4. **Mobile Testing** - Use DevTools device emulation (F12 → Ctrl+Shift+M)

---

## Next: Learn React Basics

Check `README.md` for concepts like:
- Components
- State (`useState`)
- Props
- Lists (`.map()`)
- Forms

---

**You're all set! Happy coding! 🚀**
