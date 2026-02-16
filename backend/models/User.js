const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    maxlength: 30,
    match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password required only if not using Google OAuth
    },
    minlength: 6
  },
  
  // Authentication
  googleId: String,
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // User Type & Role
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  phone: {
    type: String
  },

  phoneVerified: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // Student Information
  university: {
    name: String,
    email: String, // For verification
    studentId: String,
    graduationYear: Number,
    major: String
  },
  
  // Landlord Information
  landlordInfo: {
    companyName: String,
    licenseNumber: String,
    phone: String,
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'Morocco' }
    },
    isVerified: { type: Boolean, default: false },
    verificationDocuments: [String] // Array of document URLs
  },
  
  // Profile Information
  profilePicture: String,
  phone: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  
  // Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'MAD' }
  },
  
  // Activity Tracking
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  
  // Social Features
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dorm' }],
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  
  // Analytics
  profileViews: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ 'university.name': 1 });
userSchema.index({ 'landlordInfo.isVerified': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.verificationToken;
  return userObject;
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);

