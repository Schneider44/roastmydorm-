// RoommateMessage Model Schema
// For real-time chat between users

// MongoDB/Mongoose Example:
/*
const mongoose = require('mongoose');

const roommateMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateProfile',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoommateProfile',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
roommateMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
roommateMessageSchema.index({ receiverId: 1, read: 1 });

module.exports = mongoose.model('RoommateMessage', roommateMessageSchema);
*/

// Prisma Example:
/*
model RoommateMessage {
  id         String   @id @default(uuid())
  senderId   String
  receiverId String
  text       String   @db.Text
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())
  
  sender   RoommateProfile @relation("SentMessages", fields: [senderId], references: [id])
  receiver RoommateProfile @relation("ReceivedMessages", fields: [receiverId], references: [id])
  
  @@index([senderId, receiverId, createdAt])
  @@index([receiverId, read])
}

model RoommateProfile {
  // ... existing fields
  sentMessages     RoommateMessage[] @relation("SentMessages")
  receivedMessages RoommateMessage[] @relation("ReceivedMessages")
}
*/

// Firebase/Firestore Structure:
/*
Collection: roommateMessages
Subcollection structure (for scalability):
- Messages stored per chat pair
- Path: roommateMessages/{chatId}/messages/{messageId}
- chatId = sorted([userId1, userId2]).join('_')

Document Structure:
{
  senderId: string,
  receiverId: string,
  text: string,
  read: boolean,
  createdAt: timestamp
}

Alternatively, flat structure:
Collection: roommateMessages
Document Structure:
{
  id: auto,
  senderId: string,
  receiverId: string,
  text: string,
  read: boolean,
  createdAt: timestamp
}
Indexes: senderId, receiverId, createdAt (descending)
*/

// TypeScript Interface:
/*
export interface RoommateMessage {
  id?: string;
  senderId: string;
  receiverId: string;
  text: string;
  read: boolean;
  createdAt: Date;
}
*/

module.exports = {
  schema: {
    required: ['senderId', 'receiverId', 'text'],
    optional: ['read'],
    defaults: {
      read: false
    }
  }
};









