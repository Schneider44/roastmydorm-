const mongoose = require('mongoose');

const roommateProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 35
  },
  university: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  cleanlinessLevel: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  sleepSchedule: {
    type: String,
    enum: ['Early Bird (10 PM - 6 AM)', 'Regular (11 PM - 7 AM)', 'Night Owl (1 AM - 9 AM)', 'Flexible'],
    required: true
  },
  studyHabits: {
    type: String,
    enum: ['Quiet study preferred', 'Study with music', 'Study groups', 'Mixed (quiet & groups)'],
    required: true
  },
  socialLevel: {
    type: String,
    enum: ['Very Social', 'Social', 'Moderate', 'Quiet'],
    required: true
  },
  personality: {
    type: String,
    enum: ['Introvert', 'Extrovert', 'Ambivert'],
    required: true
  },
  interests: [{
    type: String
  }],
  smokingPreference: {
    type: String,
    enum: ['No smoking', 'Occasionally', 'Regularly'],
    required: true
  },
  petsTolerance: {
    type: String,
    enum: ['Love pets', 'Neutral', 'No pets'],
    required: true
  },
  budgetMin: {
    type: Number,
    required: true
  },
  budgetMax: {
    type: Number,
    required: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  avatarUrl: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationLevel: {
    type: String,
    enum: ['none', 'email', 'phone', 'id'],
    default: 'none'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // ...existing code...
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('RoommateProfile', roommateProfileSchema);

// Prisma Example (schema.prisma):
/*
  studyHabits      String
  socialLevel      String
  personality      String
  interests        String[] // Array in Prisma
  smokingPreference String
  petsTolerance    String
  budgetMin        Int
  budgetMax        Int
  bio              String?  @db.Text
  profilePhoto     String?
  isConfirmed      Boolean  @default(false)
  confirmedWith    String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([university])
  @@index([location])
  @@index([isConfirmed])
}
*/

// Firebase/Firestore Structure:
/*
Collection: roommateProfiles
Document Structure:
{
  userId: string (unique),
  name: string,
  age: number,
  university: string,
  location: string,
  cleanlinessLevel: number (1-5),
  sleepSchedule: string,
  studyHabits: string,
  socialLevel: string,
  personality: string,
  interests: string[],
  smokingPreference: string,
  petsTolerance: string,
  budgetMin: number,
  budgetMax: number,
  bio: string,
  profilePhoto: string (URL),
  isConfirmed: boolean,
  confirmedWith: string | null,
  createdAt: timestamp,
  updatedAt: timestamp
}
*/

// TypeScript Interface (for type safety):
/*
export interface RoommateProfile {
  id?: string;
  userId: string;
  name: string;
  age: number;
  university: string;
  location: string;
  cleanlinessLevel: number;
  sleepSchedule: string;
  studyHabits: string;
  socialLevel: string;
  personality: 'Introvert' | 'Extrovert' | 'Ambivert';
  interests: string[];
  smokingPreference: 'No smoking' | 'Occasionally' | 'Regularly';
  petsTolerance: 'Love pets' | 'Neutral' | 'No pets';
  budgetMin: number;
  budgetMax: number;
  bio: string;
  profilePhoto?: string;
  isConfirmed: boolean;
  confirmedWith?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
*/


