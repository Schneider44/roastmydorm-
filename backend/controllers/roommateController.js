// Roommate Controller - Mock Implementation
// Replace these functions with real database operations

// Mock database storage (replace with MongoDB, Firebase, Prisma, etc.)
let mockProfiles = [];
let mockMessages = [];
let mockMatches = [];
let mockMeetings = [];
let currentUserId = null;

// Initialize with dummy data
const initializeDummyData = () => {
  if (mockProfiles.length > 0) return;
  
  mockProfiles = [
    {
      id: '1',
      userId: 'user1',
      name: 'Amina Benali',
      age: 21,
      university: 'Université Mohammed V',
      location: 'Rabat',
      cleanlinessLevel: 4,
      sleepSchedule: 'Early Bird (10 PM - 6 AM)',
      studyHabits: 'Quiet study preferred',
      socialLevel: 'Moderate',
      personality: 'Introvert',
      interests: ['Reading', 'Yoga', 'Photography'],
      smokingPreference: 'No smoking',
      petsTolerance: 'Love pets',
      budgetMin: 2000,
      budgetMax: 3000,
      bio: 'Looking for a clean and quiet roommate who values personal space.',
      profilePhoto: 'https://i.pravatar.cc/150?img=1',
      isConfirmed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      userId: 'user2',
      name: 'Youssef Alaoui',
      age: 22,
      university: 'Université Hassan II',
      location: 'Casablanca',
      cleanlinessLevel: 5,
      sleepSchedule: 'Night Owl (1 AM - 9 AM)',
      studyHabits: 'Study with music',
      socialLevel: 'Very Social',
      personality: 'Extrovert',
      interests: ['Gaming', 'Music', 'Sports'],
      smokingPreference: 'Occasionally',
      petsTolerance: 'Neutral',
      budgetMin: 2500,
      budgetMax: 4000,
      bio: 'Easy-going and social person. Looking for someone fun!',
      profilePhoto: 'https://i.pravatar.cc/150?img=2',
      isConfirmed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      userId: 'user3',
      name: 'Fatima Zohra',
      age: 20,
      university: 'Université Cadi Ayyad',
      location: 'Marrakech',
      cleanlinessLevel: 5,
      sleepSchedule: 'Regular (11 PM - 7 AM)',
      studyHabits: 'Study groups',
      socialLevel: 'Social',
      personality: 'Ambivert',
      interests: ['Cooking', 'Art', 'Travel'],
      smokingPreference: 'No smoking',
      petsTolerance: 'Love pets',
      budgetMin: 1800,
      budgetMax: 2800,
      bio: 'Love cooking and trying new recipes.',
      profilePhoto: 'https://i.pravatar.cc/150?img=3',
      isConfirmed: false,
      createdAt: new Date().toISOString()
    }
  ];
};

initializeDummyData();

const RoommateController = {
  // Create or update profile
  createProfile: async (req, res) => {
    try {
      const profileData = req.body;
      
      // In real app: validate with schema, save to DB
      const profile = {
        id: profileData.id || `profile_${Date.now()}`,
        userId: profileData.userId || `user_${Date.now()}`,
        ...profileData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isConfirmed: false
      };
      
      const existingIndex = mockProfiles.findIndex(p => p.userId === profile.userId);
      if (existingIndex >= 0) {
        mockProfiles[existingIndex] = { ...mockProfiles[existingIndex], ...profile, updatedAt: new Date().toISOString() };
        res.json(mockProfiles[existingIndex]);
      } else {
        mockProfiles.push(profile);
        res.json(profile);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get current user's profile
  getMyProfile: async (req, res) => {
    try {
      // In real app: get userId from auth token
      const userId = req.query.userId || currentUserId || 'user1';
      const profile = mockProfiles.find(p => p.userId === userId);
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update profile
  updateProfile: async (req, res) => {
    try {
      const userId = req.query.userId || currentUserId || 'user1';
      const updates = req.body;
      
      const index = mockProfiles.findIndex(p => p.userId === userId);
      if (index === -1) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      mockProfiles[index] = {
        ...mockProfiles[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      res.json(mockProfiles[index]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all profiles (excluding current user and confirmed ones)
  getAllProfiles: async (req, res) => {
    try {
      const userId = req.query.userId || currentUserId || 'user1';
      const currentProfile = mockProfiles.find(p => p.userId === userId);
      
      if (!currentProfile) {
        return res.json([]);
      }
      
      // Get confirmed user IDs
      const confirmedIds = mockMatches
        .filter(m => (m.user1Id === userId || m.user2Id === userId) && m.status === 'confirmed')
        .map(m => m.user1Id === userId ? m.user2Id : m.user1Id);
      
      const availableProfiles = mockProfiles.filter(
        p => p.userId !== userId && !p.isConfirmed && !confirmedIds.includes(p.userId)
      );
      
      res.json(availableProfiles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get profile by ID
  getProfileById: async (req, res) => {
    try {
      const { id } = req.params;
      const profile = mockProfiles.find(p => p.id === id || p.userId === id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get matches with compatibility scores (requires matching algorithm)
  getMatches: async (req, res) => {
    try {
      const userId = req.query.userId || currentUserId || 'user1';
      const currentProfile = mockProfiles.find(p => p.userId === userId);
      
      if (!currentProfile) {
        return res.json([]);
      }
      
      // Import matching algorithm
      const { calculateMatchScore, sortByMatchScore } = require('../utils/matchScore');
      
      // Get available profiles
      const allProfiles = await RoommateController.getAllProfiles(req, res);
      const availableProfiles = JSON.parse(JSON.stringify(allProfiles));
      
      // Calculate scores and sort
      const matches = sortByMatchScore(currentProfile, availableProfiles);
      
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get compatibility score between two profiles
  getCompatibilityScore: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.query.userId || currentUserId || 'user1';
      
      const currentProfile = mockProfiles.find(p => p.userId === userId);
      const otherProfile = mockProfiles.find(p => p.id === id || p.userId === id);
      
      if (!currentProfile || !otherProfile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      const { calculateMatchScore } = require('../utils/matchScore');
      const score = calculateMatchScore(currentProfile, otherProfile);
      
      res.json(score);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Send message
  sendMessage: async (req, res) => {
    try {
      const { senderId, receiverId, text } = req.body;
      
      const message = {
        id: `msg_${Date.now()}`,
        senderId,
        receiverId,
        text,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      mockMessages.push(message);
      
      // In real app: emit WebSocket event for real-time
      // io.to(receiverId).emit('newMessage', message);
      
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get messages between two users
  getMessages: async (req, res) => {
    try {
      const { partnerId } = req.params;
      const userId = req.query.userId || currentUserId || 'user1';
      
      const messages = mockMessages.filter(
        m => (m.senderId === userId && m.receiverId === partnerId) ||
             (m.senderId === partnerId && m.receiverId === userId)
      ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Mark message as read
  markMessageRead: async (req, res) => {
    try {
      const { id } = req.params;
      const message = mockMessages.find(m => m.id === id);
      
      if (message) {
        message.read = true;
        res.json(message);
      } else {
        res.status(404).json({ error: 'Message not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Confirm match
  confirmMatch: async (req, res) => {
    try {
      const { user1Id, user2Id, confirmedBy } = req.body;
      
      const match = {
        id: `match_${Date.now()}`,
        user1Id,
        user2Id,
        confirmedBy,
        status: 'confirmed',
        confirmedAt: new Date().toISOString()
      };
      
      mockMatches.push(match);
      
      // Update profiles
      const profile1 = mockProfiles.find(p => p.userId === user1Id);
      const profile2 = mockProfiles.find(p => p.userId === user2Id);
      
      if (profile1) profile1.isConfirmed = true;
      if (profile2) profile2.isConfirmed = true;
      
      res.json(match);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get confirmed matches
  getConfirmedMatches: async (req, res) => {
    try {
      const userId = req.query.userId || currentUserId || 'user1';
      
      const matches = mockMatches.filter(
        m => (m.user1Id === userId || m.user2Id === userId) && m.status === 'confirmed'
      );
      
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Schedule meeting
  scheduleMeeting: async (req, res) => {
    try {
      const meetingData = req.body;
      
      const meeting = {
        id: `meeting_${Date.now()}`,
        ...meetingData,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };
      
      mockMeetings.push(meeting);
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get my meetings
  getMyMeetings: async (req, res) => {
    try {
      const userId = req.query.userId || currentUserId || 'user1';
      
      const meetings = mockMeetings.filter(
        m => m.scheduledBy === userId || m.matchId.includes(userId)
      );
      
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = RoommateController;


























