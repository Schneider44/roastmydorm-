const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Participants
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Related entities
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm'
  },
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  },
  
  // Message content
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  messageType: {
    type: String,
    enum: ['inquiry', 'response', 'follow_up', 'booking', 'general'],
    default: 'inquiry'
  },
  
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'replied'],
    default: 'sent'
  },
  readAt: Date,
  
  // Attachments
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'link']
    },
    url: String,
    filename: String,
    size: Number
  }],
  
  // Thread information
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageThread'
  },
  isThreadStarter: {
    type: Boolean,
    default: false
  },
  
  // Auto-responses and templates
  isAutoResponse: {
    type: Boolean,
    default: false
  },
  templateId: String,
  
  // Moderation
  isModerated: {
    type: Boolean,
    default: false
  },
  moderationNotes: String,

  // Safety flags and reporting
  flags: [{ type: String }], // e.g. ["payment_request","whatsapp_deposit"]
  isReported: {
    type: Boolean,
    default: false
  },

  // Analytics
  responseTime: Number, // in minutes
  isUrgent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Message thread schema
const messageThreadSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm'
  },
  subject: String,
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true
});

// Indexes for better performance
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ threadId: 1, createdAt: 1 });
messageSchema.index({ dorm: 1 });
messageSchema.index({ status: 1 });

messageThreadSchema.index({ participants: 1 });
messageThreadSchema.index({ dorm: 1 });
messageThreadSchema.index({ lastMessageAt: -1 });

// Virtual for message age
messageSchema.virtual('age').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffMinutes = Math.ceil(diffTime / (1000 * 60));
  
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
  return `${Math.floor(diffMinutes / 1440)} days ago`;
});

// Mark as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Create or get thread
messageSchema.statics.createOrGetThread = async function(senderId, recipientId, dormId = null) {
  let thread = await this.findOne({
    participants: { $all: [senderId, recipientId] },
    dorm: dormId
  });
  
  if (!thread) {
    thread = new this({
      participants: [senderId, recipientId],
      dorm: dormId,
      unreadCount: new Map()
    });
    await thread.save();
  }
  
  return thread;
};

// Update thread with new message
messageSchema.methods.updateThread = async function() {
  if (this.threadId) {
    const thread = await this.model('MessageThread').findById(this.threadId);
    if (thread) {
      thread.lastMessage = this._id;
      thread.lastMessageAt = this.createdAt;
      
      // Update unread count for recipient
      const currentCount = thread.unreadCount.get(this.recipient.toString()) || 0;
      thread.unreadCount.set(this.recipient.toString(), currentCount + 1);
      
      await thread.save();
    }
  }
};

// Mark thread messages as read
messageThreadSchema.methods.markAsRead = async function(userId) {
  this.unreadCount.set(userId.toString(), 0);
  await this.save();
  
  // Mark all messages in thread as read
  await this.model('Message').updateMany(
    { threadId: this._id, recipient: userId, status: { $ne: 'read' } },
    { status: 'read', readAt: new Date() }
  );
};

// Pre-save middleware
messageSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Create or get thread
    const thread = await this.model('MessageThread').createOrGetThread(
      this.sender,
      this.recipient,
      this.dorm
    );
    
    this.threadId = thread._id;
    this.isThreadStarter = !thread.lastMessage;
  }
  next();
});

// Post-save middleware
messageSchema.post('save', async function() {
  await this.updateThread();
});

const Message = mongoose.model('Message', messageSchema);
const MessageThread = mongoose.model('MessageThread', messageThreadSchema);

module.exports = { Message, MessageThread };

