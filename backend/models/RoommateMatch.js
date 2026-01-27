// RoommateMatch Model Schema
// Tracks confirmed matches and meeting schedules

// MongoDB/Mongoose Example:
/*
const mongoose = require('mongoose');

const roommateMatchSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateProfile',
    required: true
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateProfile',
    required: true
  },
  confirmedAt: {
    type: Date,
    default: Date.now
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateProfile',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  }
}, {
  // Ensure unique pairs
  timestamps: true
});

// Unique constraint: one match per pair
roommateMatchSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

module.exports = mongoose.model('RoommateMatch', roommateMatchSchema);
*/

// Meeting Schedule Schema:
/*
const meetingSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateMatch',
    required: true
  },
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateProfile',
    required: true
  },
  meetingType: {
    type: String,
    enum: ['video_call', 'external_link', 'in_person'],
    required: true
  },
  meetingLink: {
    type: String,
    required: function() {
      return this.meetingType === 'external_link';
    }
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Meeting', meetingSchema);
*/

// Prisma Example:
/*
model RoommateMatch {
  id          String   @id @default(uuid())
  user1Id     String
  user2Id     String
  confirmedAt DateTime @default(now())
  confirmedBy String
  status      String   @default("pending")
  
  @@unique([user1Id, user2Id])
  @@index([user1Id])
  @@index([user2Id])
}

model Meeting {
  id            String   @id @default(uuid())
  matchId       String
  scheduledBy   String
  meetingType   String
  meetingLink   String?
  scheduledDate DateTime
  scheduledTime String
  notes         String?
  status        String   @default("scheduled")
  createdAt     DateTime @default(now())
  
  @@index([matchId])
}
*/

// Firebase Structure:
/*
Collection: roommateMatches
Document Structure:
{
  id: auto,
  user1Id: string,
  user2Id: string,
  confirmedAt: timestamp,
  confirmedBy: string,
  status: 'pending' | 'confirmed' | 'cancelled'
}

Collection: meetings
Document Structure:
{
  id: auto,
  matchId: string,
  scheduledBy: string,
  meetingType: 'video_call' | 'external_link' | 'in_person',
  meetingLink?: string,
  scheduledDate: timestamp,
  scheduledTime: string,
  notes?: string,
  status: 'scheduled' | 'completed' | 'cancelled',
  createdAt: timestamp
}
*/

module.exports = {
  match: {
    required: ['user1Id', 'user2Id', 'confirmedBy'],
    statuses: ['pending', 'confirmed', 'cancelled']
  },
  meeting: {
    required: ['matchId', 'scheduledBy', 'meetingType', 'scheduledDate', 'scheduledTime'],
    optional: ['meetingLink', 'notes'],
    types: ['video_call', 'external_link', 'in_person'],
    statuses: ['scheduled', 'completed', 'cancelled']
  }
};









