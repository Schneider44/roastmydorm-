/**
 * Admin User Seeder Script
 * Run this script to create an admin user for the dashboard
 * Usage: node scripts/seedAdmin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

// Admin credentials
const ADMIN_EMAIL = 'redasneijder@gmail.com';
const ADMIN_PASSWORD = 'RedaSch06';
const ADMIN_FIRST_NAME = 'Reda';
const ADMIN_LAST_NAME = 'Admin';

// User schema (simplified for seeding)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  userType: { type: String, enum: ['student', 'landlord', 'admin'], default: 'student' },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isSuperAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

async function seedAdmin() {
  let mongoServer;
  
  try {
    let mongoUri = process.env.MONGODB_URI;
    
    // If no valid MongoDB URI or localhost not running, use memory server
    if (!mongoUri || mongoUri.includes('localhost') || mongoUri.includes('cluster0.mongodb.net')) {
      console.log('Starting in-memory MongoDB server...');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log('In-memory MongoDB started at:', mongoUri);
      
      // Update .env with the memory server URI for this session
      process.env.MONGODB_URI = mongoUri;
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get or create User model
    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      // Update existing user to admin
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await User.updateOne(
        { email: ADMIN_EMAIL },
        {
          $set: {
            password: hashedPassword,
            userType: 'admin',
            isSuperAdmin: true,
            isVerified: true,
            isActive: true,
            firstName: ADMIN_FIRST_NAME,
            lastName: ADMIN_LAST_NAME
          }
        }
      );
      console.log('✅ Existing user updated to admin successfully!');
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await User.create({
        email: ADMIN_EMAIL,
        password: hashedPassword,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        userType: 'admin',
        isSuperAdmin: true,
        isVerified: true,
        isActive: true
      });
      console.log('✅ Admin user created successfully!');
    }

    console.log('\n📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password:', ADMIN_PASSWORD);
    
    if (mongoServer) {
      console.log('\n⚠️  Note: Using in-memory MongoDB.');
      console.log('The admin will be created when you start the server with memory DB.');
      console.log('\nTo use permanently, set up MongoDB Atlas or install MongoDB locally.');
    } else {
      console.log('\nYou can now log in to the admin dashboard!');
    }

  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  } finally {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

seedAdmin();
