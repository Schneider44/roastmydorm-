const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
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
  // ...other profile fields as needed
});

module.exports = mongoose.model('Profile', profileSchema);
