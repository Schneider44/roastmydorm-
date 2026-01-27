// Roommate Data Management - localStorage based
// This mimics a database for the roommate feature

const RoommateDB = {
  // Initialize dummy data if needed
  initialize: function() {
    if (!localStorage.getItem('roommate_profiles')) {
      const dummyProfiles = [
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
      localStorage.setItem('roommate_profiles', JSON.stringify(dummyProfiles));
    }
  },

  // Get current user ID
  getCurrentUserId: function() {
    let userId = localStorage.getItem('current_user_id');
    if (!userId) {
      userId = 'user_' + Date.now();
      localStorage.setItem('current_user_id', userId);
    }
    return userId;
  },

  // Save profile
  saveProfile: function(profileData) {
    const profiles = this.getAllProfiles();
    const userId = this.getCurrentUserId();
    
    const profile = {
      id: profileData.id || 'profile_' + Date.now(),
      userId: userId,
      ...profileData,
      createdAt: profileData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isConfirmed: profileData.isConfirmed || false
    };

    const existingIndex = profiles.findIndex(p => p.userId === userId);
    if (existingIndex >= 0) {
      profiles[existingIndex] = { ...profiles[existingIndex], ...profile, updatedAt: new Date().toISOString() };
    } else {
      profiles.push(profile);
    }

    localStorage.setItem('roommate_profiles', JSON.stringify(profiles));
    return profile;
  },

  // Get current user's profile
  getMyProfile: function() {
    const userId = this.getCurrentUserId();
    const profiles = this.getAllProfiles();
    return profiles.find(p => p.userId === userId) || null;
  },

  // Get all profiles
  getAllProfiles: function() {
    return JSON.parse(localStorage.getItem('roommate_profiles') || '[]');
  },

  // Get profile by ID
  getProfileById: function(id) {
    const profiles = this.getAllProfiles();
    return profiles.find(p => p.id === id || p.userId === id) || null;
  },

  // Get available profiles (excluding current user, confirmed, and declined ones)
  getAvailableProfiles: function() {
    const userId = this.getCurrentUserId();
    const profiles = this.getAllProfiles();
    const matches = this.getConfirmations();
    const excludedIds = matches
      .filter(m => m.status === 'confirmed' || m.status === 'declined')
      .flatMap(m => [m.user1Id, m.user2Id]);
    
    return profiles.filter(p => p.userId !== userId && !excludedIds.includes(p.userId));
  },

  // Messages
  saveMessage: function(senderId, receiverId, text) {
    const messages = this.getMessages(senderId, receiverId);
    const message = {
      id: 'msg_' + Date.now(),
      senderId,
      receiverId,
      text,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    const allMessages = JSON.parse(localStorage.getItem('roommate_messages') || '[]');
    allMessages.push(message);
    localStorage.setItem('roommate_messages', JSON.stringify(allMessages));
    return message;
  },

  getMessages: function(userId1, userId2) {
    const allMessages = JSON.parse(localStorage.getItem('roommate_messages') || '[]');
    return allMessages.filter(
      m => (m.senderId === userId1 && m.receiverId === userId2) ||
           (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  // Match confirmations
  confirmMatch: function(user1Id, user2Id, confirmedBy) {
    const matches = this.getConfirmations();
    const match = {
      id: 'match_' + Date.now(),
      user1Id,
      user2Id,
      confirmedBy,
      status: 'confirmed',
      confirmedAt: new Date().toISOString()
    };
    
    matches.push(match);
    localStorage.setItem('roommate_matches', JSON.stringify(matches));
    
    // Update profiles
    const profiles = this.getAllProfiles();
    profiles.forEach(p => {
      if (p.userId === user1Id || p.userId === user2Id) {
        p.isConfirmed = true;
      }
    });
    localStorage.setItem('roommate_profiles', JSON.stringify(profiles));
    
    return match;
  },

  getConfirmations: function() {
    return JSON.parse(localStorage.getItem('roommate_matches') || '[]');
  },

  isConfirmed: function(userId1, userId2) {
    const matches = this.getConfirmations();
    return matches.some(
      m => ((m.user1Id === userId1 && m.user2Id === userId2) ||
            (m.user1Id === userId2 && m.user2Id === userId1)) &&
           m.status === 'confirmed'
    );
  },

  // Decline match
  declineMatch: function(user1Id, user2Id) {
    const matches = this.getConfirmations();
    // Check if already declined
    const existingDecline = matches.find(
      m => ((m.user1Id === user1Id && m.user2Id === user2Id) ||
            (m.user1Id === user2Id && m.user2Id === user1Id)) &&
           m.status === 'declined'
    );
    
    if (existingDecline) {
      return existingDecline;
    }
    
    const declinedMatch = {
      id: 'decline_' + Date.now(),
      user1Id,
      user2Id,
      status: 'declined',
      declinedAt: new Date().toISOString()
    };
    
    matches.push(declinedMatch);
    localStorage.setItem('roommate_matches', JSON.stringify(matches));
    
    return declinedMatch;
  },

  isDeclined: function(userId1, userId2) {
    const matches = this.getConfirmations();
    return matches.some(
      m => ((m.user1Id === userId1 && m.user2Id === userId2) ||
            (m.user1Id === userId2 && m.user2Id === userId1)) &&
           m.status === 'declined'
    );
  },

  // Meetings
  scheduleMeeting: function(meetingData) {
    const meetings = JSON.parse(localStorage.getItem('roommate_meetings') || '[]');
    const meeting = {
      id: 'meeting_' + Date.now(),
      ...meetingData,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    meetings.push(meeting);
    localStorage.setItem('roommate_meetings', JSON.stringify(meetings));
    return meeting;
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  RoommateDB.initialize();
}


