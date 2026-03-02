const mongoose = require('mongoose');

const roommateMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  }
}, { timestamps: true });

roommateMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
roommateMessageSchema.index({ receiverId: 1, read: 1 });

module.exports = mongoose.model('RoommateMessage', roommateMessageSchema);
