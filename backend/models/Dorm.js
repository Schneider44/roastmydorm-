const mongoose = require('mongoose');

const dormSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  shortDescription: {
    type: String,
    maxlength: 200
  },
  
  // Location Information
  location: {
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: String,
      country: { type: String, default: 'Morocco' }
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    nearbyUniversities: [{
      name: String,
      distance: Number, // in kilometers
      walkingTime: Number // in minutes
    }],
    nearbyAmenities: [{
      name: String,
      type: {
        type: String,
        enum: ['restaurant', 'grocery', 'pharmacy', 'bank', 'transport', 'hospital', 'gym', 'park']
      },
      distance: Number
    }]
  },
  
  // Property Details
  propertyType: {
    type: String,
    enum: ['dormitory', 'apartment', 'studio', 'shared_room', 'private_room'],
    required: true
  },
  roomTypes: [{
    type: {
      type: String,
      enum: ['single', 'double', 'triple', 'quad', 'studio', 'apartment']
    },
    price: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    utilities: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    total: { type: Number, required: true },
    description: String,
    size: Number, // in square meters
    amenities: [String]
  }],
  
  // Pricing
  pricing: {
    baseRent: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    utilities: { type: Number, default: 0 },
    internet: { type: Number, default: 0 },
    cleaning: { type: Number, default: 0 },
    currency: { type: String, default: 'MAD' },
    billingCycle: { type: String, enum: ['monthly', 'semester', 'yearly'], default: 'monthly' }
  },
  
  // Amenities & Features
  amenities: {
    basic: [{
      type: String,
      enum: ['wifi', 'heating', 'air_conditioning', 'furnished', 'kitchen', 'bathroom', 'laundry']
    }],
    security: [{
      type: String,
      enum: ['security_guard', 'cctv', 'keycard_access', 'gated_community', 'safe']
    }],
    common: [{
      type: String,
      enum: ['study_room', 'common_room', 'gym', 'pool', 'garden', 'rooftop', 'parking', 'elevator']
    }],
    services: [{
      type: String,
      enum: ['cleaning_service', 'maintenance', '24_7_support', 'meal_plan', 'laundry_service']
    }]
  },
  
  // Images & Media
  images: [{
    url: { type: String, required: true },
    caption: String,
    isPrimary: { type: Boolean, default: false },
    category: {
      type: String,
      enum: ['exterior', 'interior', 'room', 'common_area', 'amenity', 'neighborhood']
    }
  }],
  virtualTour: String, // URL to virtual tour
  
  // Availability & Booking
  availability: {
    isAvailable: { type: Boolean, default: true },
    availableFrom: Date,
    availableUntil: Date,
    minimumStay: { type: Number, default: 1 }, // in months
    maximumStay: Number, // in months
    bookingCalendar: [{
      date: Date,
      isAvailable: Boolean,
      price: Number
    }]
  },
  
  // Rules & Policies
  rules: [{
    title: String,
    description: String,
    category: {
      type: String,
      enum: ['general', 'noise', 'guests', 'pets', 'smoking', 'cleaning', 'maintenance']
    }
  }],
  
  // Landlord Information
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Verification & Trust
  verification: {
    isVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    documents: [String], // URLs to verification documents
    badges: [{
      type: String,
      enum: ['verified_listing', 'premium_landlord', 'quick_response', 'excellent_reviews']
    }]
  },
  
  // Reviews & Ratings
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  ratingBreakdown: {
    cleanliness: { type: Number, default: 0 },
    safety: { type: Number, default: 0 },
    location: { type: Number, default: 0 },
    landlord: { type: Number, default: 0 },
    value: { type: Number, default: 0 }
  },
  
  // Analytics & Performance
  analytics: {
    views: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
    bookings: { type: Number, default: 0 },
    lastViewed: Date
  },
  
  // Status & Moderation
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'rejected', 'suspended'],
    default: 'pending'
  },
  moderationNotes: String,
  publishedAt: Date,
  
  // SEO & Search
  tags: [String],
  keywords: [String],
  
  // Contact Information
  contactInfo: {
    phone: String,
    email: String,
    website: String,
    responseTime: String, // e.g., "within 2 hours"
    preferredContact: {
      type: String,
      enum: ['phone', 'email', 'message', 'any'],
      default: 'message'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
dormSchema.index({ 'location.coordinates': '2dsphere' });
dormSchema.index({ 'location.city': 1 });
dormSchema.index({ 'pricing.baseRent': 1 });
dormSchema.index({ averageRating: -1 });
dormSchema.index({ status: 1 });
dormSchema.index({ landlord: 1 });
dormSchema.index({ 'amenities.basic': 1 });
dormSchema.index({ tags: 1 });
dormSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Virtual for total price
dormSchema.virtual('totalPrice').get(function() {
  return this.pricing.baseRent + this.pricing.utilities + this.pricing.internet + this.pricing.cleaning;
});

// Virtual for primary image
dormSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

// Update analytics
dormSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  this.analytics.lastViewed = new Date();
  return this.save();
};

dormSchema.methods.incrementFavorites = function() {
  this.analytics.favorites += 1;
  return this.save();
};

dormSchema.methods.decrementFavorites = function() {
  this.analytics.favorites = Math.max(0, this.analytics.favorites - 1);
  return this.save();
};

// Update rating
dormSchema.methods.updateRating = function() {
  return this.model('Review').aggregate([
    { $match: { dorm: this._id } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$overallRating' },
        totalReviews: { $sum: 1 },
        cleanliness: { $avg: '$ratings.cleanliness' },
        safety: { $avg: '$ratings.safety' },
        location: { $avg: '$ratings.location' },
        landlord: { $avg: '$ratings.landlord' },
        value: { $avg: '$ratings.value' }
      }
    }
  ]).then(result => {
    if (result.length > 0) {
      const stats = result[0];
      this.averageRating = Math.round(stats.averageRating * 10) / 10;
      this.totalReviews = stats.totalReviews;
      this.ratingBreakdown = {
        cleanliness: Math.round(stats.cleanliness * 10) / 10,
        safety: Math.round(stats.safety * 10) / 10,
        location: Math.round(stats.location * 10) / 10,
        landlord: Math.round(stats.landlord * 10) / 10,
        value: Math.round(stats.value * 10) / 10
      };
    } else {
      this.averageRating = 0;
      this.totalReviews = 0;
      this.ratingBreakdown = {
        cleanliness: 0,
        safety: 0,
        location: 0,
        landlord: 0,
        value: 0
      };
    }
    return this.save();
  });
};

// Get public data (without sensitive information)
dormSchema.methods.getPublicData = function() {
  const dormObject = this.toObject();
  delete dormObject.analytics;
  delete dormObject.moderationNotes;
  return dormObject;
};

module.exports = mongoose.model('Dorm', dormSchema);

