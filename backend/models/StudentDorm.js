const mongoose = require('mongoose');

const studentDormSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    enum: ['casablanca', 'rabat', 'marrakech']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  roomType: {
    type: String,
    required: true,
    enum: ['single', 'shared', 'studio']
  },
  amenities: [{
    type: String,
    enum: ['wifi', 'kitchen', 'laundry', 'security', 'parking', 'ac', 'heating', 'gym']
  }],
  photos: [{
    type: String,
    required: true
  }],
  rules: [{
    type: String
  }],
  availableDates: {
    type: String,
    required: true
  },
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  landlord: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['available', 'rented', 'unavailable'],
    default: 'available'
  },
  views: {
    type: Number,
    default: 0
  },
  inquiries: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviews: {
    type: Number,
    default: 0
  },
  nearby: [{
    type: String
  }],
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  distanceToUniversity: {
    type: String
  },
  paymentOptions: [{
    id: String,
    title: String,
    description: String,
    note: String
  }]
}, {
  timestamps: true
});

// Index for search functionality
studentDormSchema.index({ city: 1 });
studentDormSchema.index({ title: 'text', description: 'text', location: 'text' });
studentDormSchema.index({ price: 1 });
studentDormSchema.index({ roomType: 1 });
studentDormSchema.index({ amenities: 1 });
studentDormSchema.index({ status: 1 });
studentDormSchema.index({ rating: -1 });

module.exports = mongoose.model('StudentDorm', studentDormSchema);
