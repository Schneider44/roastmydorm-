# Find Your Roommate Feature - Implementation Guide

## Overview

The "Find Your Roommate" feature allows students to create detailed roommate profiles, browse compatible matches, chat with potential roommates, schedule safe meetings, and confirm matches. The system includes a smart matching algorithm that calculates compatibility based on multiple lifestyle factors.

## 📁 Project Structure

```
backend/
├── models/
│   ├── RoommateProfile.js      # Profile schema (MongoDB/Prisma/Firebase)
│   ├── RoommateMessage.js       # Message schema
│   └── RoommateMatch.js         # Match confirmation schema
├── routes/
│   └── roommate.js              # API routes
├── controllers/
│   └── roommateController.js   # Mock controller (replace with real DB)
└── utils/
    └── matchScore.js            # Matching algorithm

src/
├── components/
│   └── roommate/
│       ├── ProfileForm.jsx          # Profile creation/editing
│       ├── MatchFeed.jsx            # Browse matches with filters
│       ├── MatchCard.jsx            # Individual match card
│       ├── ChatView.jsx             # Messaging interface
│       ├── ScheduleMeetModal.jsx    # Schedule meetings
│       └── ConfirmMatchButton.jsx   # Confirm roommate match
├── context/
│   └── RoommateContext.jsx     # React context for state management
├── services/
│   └── roommateAPI.js          # API service layer
└── utils/
    └── matchScore.js            # Frontend matching algorithm
```

## 🗄️ Database Schema

### RoommateProfile
- **Required fields**: name, age, university, location, cleanlinessLevel, sleepSchedule, studyHabits, socialLevel, personality, smokingPreference, petsTolerance, budgetMin, budgetMax, bio
- **Optional fields**: profilePhoto, interests (array)
- **Status fields**: isConfirmed, confirmedWith

### RoommateMessage
- **Fields**: senderId, receiverId, text, read, createdAt
- **Indexes**: (senderId, receiverId, createdAt), (receiverId, read)

### RoommateMatch
- **Fields**: user1Id, user2Id, confirmedAt, confirmedBy, status
- **Constraints**: Unique pair (user1Id, user2Id)

### Meeting
- **Fields**: matchId, scheduledBy, meetingType, meetingLink, scheduledDate, scheduledTime, notes, status

## 🚀 Getting Started

### 1. Backend Setup

The backend uses mock data stored in memory (controllers). To integrate with a real database:

#### Option A: MongoDB with Mongoose
```javascript
// In backend/controllers/roommateController.js
const RoommateProfile = require('../models/RoommateProfile');

// Replace mockProfiles operations with:
const profiles = await RoommateProfile.find({ userId: { $ne: currentUserId } });
const profile = new RoommateProfile(profileData);
await profile.save();
```

#### Option B: Prisma
```javascript
// In backend/controllers/roommateController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const profiles = await prisma.roommateProfile.findMany({
  where: { userId: { not: currentUserId } }
});
```

#### Option C: Firebase Firestore
```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

const profilesRef = db.collection('roommateProfiles');
const profiles = await profilesRef.where('userId', '!=', currentUserId).get();
```

### 2. Frontend Setup

1. Install dependencies (if needed):
```bash
npm install lucide-react
```

2. Set environment variable for API URL:
```bash
# .env
REACT_APP_API_URL=http://localhost:5000/api/roommate
```

3. If API URL is not set, the app falls back to localStorage automatically.

### 3. Running the Application

```bash
# Backend (from root)
cd backend
npm install
npm run dev

# Frontend (from root)
cd frontend  # or src if React is in root
npm install
npm start
```

## 🔌 API Endpoints

All endpoints are prefixed with `/api/roommate`:

### Profiles
- `POST /profiles` - Create profile
- `GET /profiles/me?userId=xxx` - Get current user's profile
- `PUT /profiles/me?userId=xxx` - Update profile
- `GET /profiles?userId=xxx` - Get all available profiles
- `GET /profiles/:id` - Get profile by ID

### Matches
- `GET /matches?userId=xxx` - Get matches with compatibility scores
- `GET /matches/compatibility/:id?userId=xxx` - Get compatibility score with specific profile

### Messages
- `POST /messages` - Send message `{senderId, receiverId, text}`
- `GET /messages/:partnerId?userId=xxx` - Get messages with partner
- `PUT /messages/:id/read` - Mark message as read

### Match Confirmation
- `POST /matches/confirm` - Confirm match `{user1Id, user2Id, confirmedBy}`
- `GET /matches/confirmed?userId=xxx` - Get confirmed matches

### Meetings
- `POST /meetings` - Schedule meeting
- `GET /meetings?userId=xxx` - Get user's meetings

## 🎯 Matching Algorithm

The compatibility score (0-100%) is calculated based on:

1. **University match** (15 points) - Same university
2. **Location match** (15 points) - Same location
3. **Cleanliness compatibility** (15 points) - Similar cleanliness levels
4. **Sleep schedule** (12 points) - Compatible sleep patterns
5. **Personality** (10 points) - Same personality type
6. **Social level** (10 points) - Similar social preferences
7. **Smoking preference** (10 points) - Critical compatibility factor
8. **Pets tolerance** (8 points) - Pet preferences
9. **Budget overlap** (10 points) - Overlapping budget ranges
10. **Interest overlap** (5 points) - Shared interests

The algorithm is in `backend/utils/matchScore.js` (backend) and `src/utils/matchScore.js` (frontend).

## 💬 Real-Time Messaging

### Current Implementation
- Uses localStorage (fallback) or API polling
- Messages stored in database

### Integrating WebSocket (Socket.io)

**Backend (`backend/server.js`)**:
```javascript
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('joinRoom', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('sendMessage', async (data) => {
    // Save to database
    const message = await saveMessage(data);
    
    // Emit to receiver
    io.to(`user_${data.receiverId}`).emit('newMessage', message);
    socket.emit('messageSent', message);
  });
});
```

**Frontend (`src/components/roommate/ChatView.jsx`)**:
```javascript
import io from 'socket.io-client';

useEffect(() => {
  const socket = io('http://localhost:5000');
  
  socket.emit('joinRoom', currentProfile.userId);
  
  socket.on('newMessage', (message) => {
    setMessages(prev => [...prev, message]);
  });
  
  return () => socket.disconnect();
}, []);

const handleSend = (text) => {
  socket.emit('sendMessage', {
    senderId: currentProfile.userId,
    receiverId: partnerId,
    text
  });
};
```

### Integrating Firebase Realtime

```javascript
import { getDatabase, ref, push, onValue } from 'firebase/database';

const db = getDatabase();
const messagesRef = ref(db, `chats/${chatId}/messages`);

// Listen for new messages
onValue(messagesRef, (snapshot) => {
  const messages = Object.values(snapshot.val() || {});
  setMessages(messages);
});

// Send message
push(messagesRef, {
  senderId: currentProfile.userId,
  text: messageText,
  timestamp: Date.now()
});
```

## 🎥 Video Calls

### Current Implementation
- Placeholder for in-app video calls
- Support for external links (Zoom, Google Meet)

### Integrating Real Video Calls

**Option 1: Twilio Video**
```javascript
import { connect } from '@twilio/video';

const room = await connect(token, {
  name: roomName,
  audio: true,
  video: true
});
```

**Option 2: Daily.co**
```javascript
import DailyIframe from '@daily-co/daily-js';

const callFrame = DailyIframe.createFrame({
  showLeaveButton: true,
  iframeStyle: { position: 'absolute', width: '100%', height: '100%' }
});

await callFrame.join({ url: roomUrl });
```

**Option 3: Agora**
```javascript
import AgoraRTC from 'agora-rtc-sdk-ng';

const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
await client.join(appId, channel, token, uid);
```

## ✅ Match Confirmation Flow

1. User clicks "Confirm Roommate Match" in chat
2. System creates a match record with status 'confirmed'
3. Both profiles marked as `isConfirmed: true`
4. Both profiles removed from match feed
5. Optional: Generate PDF contract (placeholder)

### PDF Contract Generation (Future)

```javascript
import jsPDF from 'jspdf';

const generateContract = (match) => {
  const doc = new jsPDF();
  doc.text('Roommate Agreement', 20, 20);
  doc.text(`Between ${match.user1.name} and ${match.user2.name}`, 20, 30);
  // Add contract terms...
  doc.save('roommate-agreement.pdf');
};
```

## 🔒 Security Considerations

1. **Authentication**: Add JWT/auth middleware to all routes
2. **Authorization**: Verify users can only access their own data
3. **Input validation**: Use Joi, Yup, or Zod for validation
4. **File uploads**: Use cloud storage (AWS S3, Cloudinary) for photos
5. **Rate limiting**: Already implemented in server.js
6. **SQL injection**: Use parameterized queries (Prisma/Mongoose handle this)

## 📝 Environment Variables

```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/ratemydorm
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development

# Frontend (.env)
REACT_APP_API_URL=http://localhost:5000/api/roommate
```

## 🧪 Testing

### Manual Testing Flow

1. Create a profile at `/find-roommate/create-profile`
2. Browse matches at `/find-roommate/matches`
3. Filter by university, location, budget, etc.
4. Click "Chat" on a match
5. Send messages
6. Schedule a meeting
7. Confirm match

### Sample Test Data

The app initializes with 3 dummy profiles:
- Amina (Rabat, Introvert, Quiet)
- Youssef (Casablanca, Extrovert, Social)
- Fatima (Marrakech, Ambivert, Social)

## 🚧 Future Enhancements

1. **Real-time notifications** - Push notifications for new messages
2. **Video verification** - Optional video verification for profiles
3. **Background checks** - Integration with verification services
4. **Payment integration** - Split rent/bills functionality
5. **Document sharing** - Secure document exchange
6. **Review system** - Review previous roommates after matching
7. **Machine learning** - Improve matching algorithm with ML
8. **Group matching** - Match multiple people for shared housing

## 📚 Additional Resources

- [Socket.io Documentation](https://socket.io/docs/)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [Twilio Video SDK](https://www.twilio.com/docs/video)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Mongoose Documentation](https://mongoosejs.com/docs/)

## 🤝 Contributing

When adding new features:

1. Update the matching algorithm if adding new profile fields
2. Add validation to both frontend and backend
3. Update API documentation
4. Test with real database (not just mocks)
5. Consider security implications

## 📞 Support

For issues or questions, refer to:
- Database models in `backend/models/`
- API routes in `backend/routes/roommate.js`
- Frontend components in `src/components/roommate/`
- Matching algorithm in `backend/utils/matchScore.js`

---

**Note**: This is a scaffold implementation. Replace mock controllers with real database operations before production use.

















