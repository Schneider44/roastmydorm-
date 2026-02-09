const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dorm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm',
    required: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  tags: [String],
  notifyOnChanges: {
    type: Boolean,
    default: false
  },
  priceAtSave: Number,
  folder: {
    type: String,
    default: 'default'
  }
}, {
  timestamps: true
});

// Ensure one favorite per user per dorm
favoriteSchema.index({ user: 1, dorm: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });
favoriteSchema.index({ user: 1, folder: 1 });

// Update dorm favorites count when a favorite is added
favoriteSchema.post('save', async function() {
  const Dorm = require('./Dorm');
  const count = await this.constructor.countDocuments({ dorm: this.dorm });
  await Dorm.findByIdAndUpdate(this.dorm, { 'analytics.favorites': count });
});

// Update dorm favorites count when a favorite is removed
favoriteSchema.post('deleteOne', { document: true, query: false }, async function() {
  const Dorm = require('./Dorm');
  const count = await this.constructor.countDocuments({ dorm: this.dorm });
  await Dorm.findByIdAndUpdate(this.dorm, { 'analytics.favorites': count });
});

module.exports = mongoose.model('Favorite', favoriteSchema);
