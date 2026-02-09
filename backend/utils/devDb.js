/**
 * Development Database Helper
 * Uses MongoMemoryServer for local development without MongoDB installation
 */

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

async function getMemoryDbUri() {
  if (!mongoServer) {
    console.log('🚀 Starting in-memory MongoDB server...');
    mongoServer = await MongoMemoryServer.create();
    console.log('✅ In-memory MongoDB server started');
  }
  return mongoServer.getUri();
}

async function stopMemoryDb() {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
    console.log('🛑 In-memory MongoDB server stopped');
  }
}

// Seed admin user when using memory DB
async function seedAdminUser(mongoose) {
  const bcrypt = require('bcryptjs');
  
  // Check if User model exists
  let User;
  try {
    User = mongoose.model('User');
  } catch {
    // Create a simple User schema for seeding (without pre-save hook)
    const userSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      firstName: String,
      lastName: String,
      userType: { type: String, enum: ['student', 'landlord', 'admin'], default: 'student' },
      isVerified: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
      isSuperAdmin: { type: Boolean, default: false }
    }, { timestamps: true });
    
    // Add comparePassword method
    userSchema.methods.comparePassword = async function(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    };
    
    User = mongoose.model('User', userSchema);
  }
  
  // Admin credentials
  const ADMIN_EMAIL = 'redasneijder@gmail.com';
  const ADMIN_PASSWORD = 'RedaSch06';
  
  // Check if admin exists
  const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
  
  if (!existingAdmin) {
    // Hash password manually (since we're using a schema without pre-save hook)
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    // Use insertOne to bypass any pre-save hooks
    await User.collection.insertOne({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: 'Reda',
      lastName: 'Admin',
      userType: 'admin',
      isSuperAdmin: true,
      isVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Admin user seeded successfully');
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔑 Password: RedaSch06');
  }
  
  // Also seed dorms
  await seedDorms(mongoose);
}

// Seed dorms for development
async function seedDorms(mongoose) {
  const bcrypt = require('bcryptjs');
  
  // First, create or get a landlord user
  let User;
  try {
    User = mongoose.model('User');
  } catch {
    return; // User model should exist by now
  }

  // Create landlord user for dorms
  let landlord = await User.findOne({ email: 'landlord@roastmydorm.com' });
  if (!landlord) {
    const hashedPassword = await bcrypt.hash('Landlord123', 12);
    const landlordDoc = await User.collection.insertOne({
      email: 'landlord@roastmydorm.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Landlord',
      userType: 'landlord',
      isVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    landlord = { _id: landlordDoc.insertedId };
    console.log('✅ Demo landlord created');
  }

  // Get or create Dorm model - Use the actual model from the app
  let Dorm;
  try {
    Dorm = mongoose.model('Dorm');
  } catch {
    // If Dorm model doesn't exist, create a simple one for seeding
    const dormSchema = new mongoose.Schema({
      name: String,
      slug: String,
      description: String,
      shortDescription: String,
      location: {
        address: {
          street: String,
          city: String,
          postalCode: String,
          country: String
        },
        coordinates: {
          latitude: Number,
          longitude: Number
        },
        nearbyUniversities: [{
          name: String,
          distance: Number,
          walkingTime: Number
        }]
      },
      propertyType: String,
      pricing: {
        baseRent: Number,
        deposit: Number,
        utilities: Number,
        currency: String,
        billingCycle: String
      },
      amenities: {
        basic: [String],
        security: [String],
        common: [String],
        services: [String]
      },
      images: [{
        url: String,
        isPrimary: Boolean,
        category: String
      }],
      roomTypes: [{
        type: String,
        price: Number,
        deposit: Number,
        utilities: Number,
        available: Number,
        total: Number,
        description: String
      }],
      availability: {
        isAvailable: Boolean,
        moveInDate: Date,
        leaseTerms: [String]
      },
      landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      averageRating: Number,
      reviewCount: Number,
      totalReviews: Number,
      status: String
    }, { timestamps: true });
    
    Dorm = mongoose.model('Dorm', dormSchema);
  }

  // Check if dorms already exist
  const existingCount = await Dorm.countDocuments();
  if (existingCount > 0) {
    console.log(`📦 ${existingCount} dorms already exist, skipping seed`);
    return;
  }

  // Generate slug helper
  function generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Dorm data
  const dormsData = [
    // RABAT DORMS
    {
      name: "The Luxury Studio - Agdal",
      description: "Premium student apartment in Agdal, Avenue Abtal, Rabat. Modern facilities with a living room, kitchen, and bathroom. Building management fees are included in the rent.",
      shortDescription: "Modern luxury studio in the heart of Agdal, Rabat",
      location: {
        address: { street: "Avenue Abtal", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9911, longitude: -6.8498 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 1.5, walkingTime: 18 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 4000, deposit: 4000, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["elevator"], services: ["cleaning_service"] },
      status: "active"
    },
    {
      name: "Agdal Apartment Premium",
      description: "Spacious furnished apartment in Agdal neighborhood. Features modern amenities, fully equipped kitchen, and comfortable living spaces.",
      shortDescription: "Spacious apartment in Agdal, Rabat",
      location: {
        address: { street: "Rue Agdal", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9925, longitude: -6.8512 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 2, walkingTime: 25 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 5500, deposit: 5500, utilities: 300, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "heating"], security: ["security_guard", "cctv"], common: ["parking", "elevator"], services: ["maintenance"] },
      status: "active"
    },
    {
      name: "Al Irfane Studio",
      description: "Modern studio near Al Irfane district. Perfect location for UIR and INSEA students. Fully furnished with all utilities included.",
      shortDescription: "Modern studio in Al Irfane, Rabat",
      location: {
        address: { street: "Hay Al Irfane", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9650, longitude: -6.8750 },
        nearbyUniversities: [{ name: "Universite Internationale de Rabat (UIR)", distance: 0.8, walkingTime: 10 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 4500, deposit: 4500, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "keycard_access"], common: ["gym", "parking"], services: ["24_7_support"] },
      status: "active"
    },
    {
      name: "Hay Riad Executive Studio",
      description: "Executive studio in the prestigious Hay Riad area. Premium finishes and modern design. Perfect for graduate students.",
      shortDescription: "Executive studio in Hay Riad, Rabat",
      location: {
        address: { street: "Hay Riad", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9580, longitude: -6.8780 },
        nearbyUniversities: [{ name: "Universite Internationale de Rabat (UIR)", distance: 3, walkingTime: 35 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 6000, deposit: 6000, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "cctv", "keycard_access"], common: ["gym", "parking", "elevator"], services: ["cleaning_service", "24_7_support"] },
      status: "active"
    },
    {
      name: "Hassan Central Apartment",
      description: "Classic apartment in Hassan district near the famous Hassan Tower. Traditional Moroccan architecture with modern amenities.",
      shortDescription: "Central apartment in Hassan, Rabat",
      location: {
        address: { street: "Avenue Hassan", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 34.0250, longitude: -6.8230 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 3, walkingTime: 40 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 3800, deposit: 3800, utilities: 250, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: [], services: [] },
      status: "active"
    },
    {
      name: "L'Ocean Studio",
      description: "Beautiful studio with ocean views in L'Ocean district. Modern furnishings with beach access nearby.",
      shortDescription: "Ocean view studio in Rabat",
      location: {
        address: { street: "Avenue de l'Ocean", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 34.0350, longitude: -6.8350 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 5, walkingTime: 60 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 4500, deposit: 4500, utilities: 300, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["parking"], services: [] },
      status: "active"
    },
    {
      name: "Hay Al Fath Apartment",
      description: "Beautiful apartment in Hay Al Fath neighborhood. Spacious rooms with natural lighting.",
      shortDescription: "Spacious apartment in Hay Al Fath, Rabat",
      location: {
        address: { street: "Hay Al Fath", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 34.0150, longitude: -6.8350 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 4, walkingTime: 50 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 4000, deposit: 4000, utilities: 300, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["parking"], services: ["maintenance"] },
      status: "active"
    },
    {
      name: "Hay Nahda Budget Apartment",
      description: "Affordable apartment in Hay Nahda. Perfect for budget-conscious students. Close to tramway.",
      shortDescription: "Budget-friendly in Hay Nahda, Rabat",
      location: {
        address: { street: "Hay Nahda", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 34.0050, longitude: -6.8550 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 3.5, walkingTime: 45 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 3000, deposit: 3000, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: [], common: [], services: [] },
      status: "active"
    },
    {
      name: "Kebibat Studio",
      description: "Quiet studio in Kebibat area. Residential neighborhood with easy access to city center.",
      shortDescription: "Quiet studio in Kebibat, Rabat",
      location: {
        address: { street: "Kebibat", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9850, longitude: -6.8420 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 2.5, walkingTime: 30 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 3200, deposit: 3200, utilities: 150, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: [], services: [] },
      status: "active"
    },
    {
      name: "Place Joulane Apartment",
      description: "Central apartment near Place Joulane. Walking distance to shops and restaurants.",
      shortDescription: "Central location at Place Joulane, Rabat",
      location: {
        address: { street: "Place Joulane", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9880, longitude: -6.8520 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 1.8, walkingTime: 22 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 4200, deposit: 4200, utilities: 250, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["elevator"], services: [] },
      status: "active"
    },
    {
      name: "Dyur Marjane Apartment",
      description: "Convenient apartment near Marjane hypermarket. All shopping needs within walking distance.",
      shortDescription: "Shopping area apartment in Rabat",
      location: {
        address: { street: "Dyur Marjane", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9750, longitude: -6.8650 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 4, walkingTime: 50 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 3500, deposit: 3500, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard", "cctv"], common: ["parking", "elevator"], services: [] },
      status: "active"
    },
    {
      name: "Izdihar Modern Apartment",
      description: "Contemporary apartment in Izdihar. New building with all modern facilities.",
      shortDescription: "Modern apartment in Izdihar, Rabat",
      location: {
        address: { street: "Hay Izdihar", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9620, longitude: -6.8720 },
        nearbyUniversities: [{ name: "Universite Internationale de Rabat (UIR)", distance: 2, walkingTime: 25 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 4200, deposit: 4200, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "cctv"], common: ["parking", "elevator"], services: [] },
      status: "active"
    },
    {
      name: "Luxury Villa Souissi",
      description: "Exclusive villa in the diplomatic Souissi area. Private garden, pool, and premium amenities.",
      shortDescription: "Exclusive villa in Souissi, Rabat",
      location: {
        address: { street: "Souissi", city: "Rabat", postalCode: "10000", country: "Morocco" },
        coordinates: { latitude: 33.9720, longitude: -6.8850 },
        nearbyUniversities: [{ name: "Universite Internationale de Rabat (UIR)", distance: 2, walkingTime: 25 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 15000, deposit: 15000, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning", "heating"], security: ["security_guard", "cctv", "keycard_access", "gated_community"], common: ["pool", "garden", "parking", "gym"], services: ["cleaning_service", "maintenance", "24_7_support", "laundry_service"] },
      status: "active"
    },

    // CASABLANCA DORMS
    {
      name: "Hay Mabrouka Studio",
      description: "Comfortable studio in Hay Mabrouka, Casablanca. Affordable option for students at nearby universities.",
      shortDescription: "Affordable studio in Hay Mabrouka, Casablanca",
      location: {
        address: { street: "Hay Mabrouka", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.5731, longitude: -7.5898 },
        nearbyUniversities: [{ name: "Universite Hassan II", distance: 3, walkingTime: 35 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 2800, deposit: 2800, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: [], common: [], services: [] },
      status: "active"
    },
    {
      name: "Ain Sebaa Budget Room",
      description: "Budget-friendly room in Ain Sebaa industrial area. Basic amenities with good transport links.",
      shortDescription: "Budget room in Ain Sebaa, Casablanca",
      location: {
        address: { street: "Ain Sebaa", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.6100, longitude: -7.5300 },
        nearbyUniversities: [{ name: "FSJES Ain Sebaa", distance: 1.5, walkingTime: 18 }]
      },
      propertyType: "private_room",
      pricing: { baseRent: 2000, deposit: 2000, utilities: 150, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "bathroom"], security: [], common: [], services: [] },
      status: "active"
    },
    {
      name: "Luxury Studio Anfa",
      description: "Premium studio in the upscale Anfa district. High-end finishes and sea views.",
      shortDescription: "Luxury living in Anfa, Casablanca",
      location: {
        address: { street: "Boulevard d'Anfa", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.5850, longitude: -7.6450 },
        nearbyUniversities: [{ name: "Universite Hassan II", distance: 5, walkingTime: 60 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 8000, deposit: 8000, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "cctv", "keycard_access", "gated_community"], common: ["gym", "pool", "parking", "elevator"], services: ["cleaning_service", "24_7_support", "laundry_service"] },
      status: "active"
    },
    {
      name: "Maarif Modern Apartment",
      description: "Stylish apartment in the trendy Maarif district. Surrounded by cafes and shops.",
      shortDescription: "Trendy apartment in Maarif, Casablanca",
      location: {
        address: { street: "Rue Maarif", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.5780, longitude: -7.6350 },
        nearbyUniversities: [{ name: "Universite Hassan II", distance: 4, walkingTime: 50 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 5500, deposit: 5500, utilities: 300, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["elevator"], services: [] },
      status: "active"
    },
    {
      name: "Sidi Maarouf Business Apartment",
      description: "Modern apartment in Sidi Maarouf business district. Close to Casa Finance City.",
      shortDescription: "Business district apartment in Casablanca",
      location: {
        address: { street: "Sidi Maarouf", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.5420, longitude: -7.6580 },
        nearbyUniversities: [{ name: "ESCA Ecole de Management", distance: 2, walkingTime: 25 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 5000, deposit: 5000, utilities: 250, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "cctv"], common: ["parking", "elevator"], services: ["maintenance"] },
      status: "active"
    },
    {
      name: "Hay Qods Bernoussi Studio",
      description: "Affordable studio in Hay Qods-Bernoussi. Quiet residential area.",
      shortDescription: "Affordable studio in Bernoussi, Casablanca",
      location: {
        address: { street: "Hay Qods Bernoussi", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.6200, longitude: -7.5150 },
        nearbyUniversities: [{ name: "FSJES Ain Sebaa", distance: 2, walkingTime: 25 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 2500, deposit: 2500, utilities: 150, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "bathroom"], security: [], common: [], services: [] },
      status: "active"
    },
    {
      name: "Charaf Apartment",
      description: "Well-located apartment in Charaf area. Easy access to university and city center.",
      shortDescription: "Convenient apartment in Charaf, Casablanca",
      location: {
        address: { street: "Charaf", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.5650, longitude: -7.6050 },
        nearbyUniversities: [{ name: "Universite Hassan II", distance: 2.5, walkingTime: 30 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 3500, deposit: 3500, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: [], services: [] },
      status: "active"
    },
    {
      name: "Bourgogne Shared Studio",
      description: "Shared studio space in the historic Bourgogne area. Great for students who like company.",
      shortDescription: "Shared living in Bourgogne, Casablanca",
      location: {
        address: { street: "Bourgogne", city: "Casablanca", postalCode: "20000", country: "Morocco" },
        coordinates: { latitude: 33.5920, longitude: -7.6180 },
        nearbyUniversities: [{ name: "Universite Hassan II", distance: 3, walkingTime: 35 }]
      },
      propertyType: "shared_room",
      pricing: { baseRent: 1800, deposit: 1800, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: [], common: ["common_room"], services: [] },
      status: "active"
    },

    // MARRAKECH DORMS
    {
      name: "Gueliz Modern Apartment",
      description: "Contemporary apartment in the modern Gueliz district. Walking distance to cafes and galleries.",
      shortDescription: "Modern living in Gueliz, Marrakech",
      location: {
        address: { street: "Avenue Mohammed V, Gueliz", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6340, longitude: -8.0100 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 3, walkingTime: 35 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 4500, deposit: 4500, utilities: 250, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard"], common: ["elevator"], services: [] },
      status: "active"
    },
    {
      name: "Abwab Marrakech Studio",
      description: "Traditional Moroccan studio with modern comforts in the Abwab area.",
      shortDescription: "Traditional studio in Abwab, Marrakech",
      location: {
        address: { street: "Abwab", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6280, longitude: -8.0250 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 4, walkingTime: 50 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 3000, deposit: 3000, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: [], common: ["rooftop"], services: [] },
      status: "active"
    },
    {
      name: "Daoudiat Family Apartment",
      description: "Spacious apartment in the Daoudiat neighborhood. Family-friendly area with parks nearby.",
      shortDescription: "Family area apartment in Daoudiat, Marrakech",
      location: {
        address: { street: "Daoudiat", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6450, longitude: -8.0300 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 2, walkingTime: 25 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 3800, deposit: 3800, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["garden", "parking"], services: [] },
      status: "active"
    },
    {
      name: "Targa Premium Apartment",
      description: "Upscale apartment in the prestigious Targa area. High-quality finishes with garden views.",
      shortDescription: "Premium apartment in Targa, Marrakech",
      location: {
        address: { street: "Route de Targa", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6550, longitude: -8.0450 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 5, walkingTime: 60 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 6500, deposit: 6500, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "cctv", "gated_community"], common: ["pool", "garden", "parking"], services: ["cleaning_service", "maintenance"] },
      status: "active"
    },
    {
      name: "Semlaliya Student Apartment",
      description: "Budget-friendly apartment near Semlaliya. Popular student area with easy access to campus.",
      shortDescription: "Student apartment in Semlaliya, Marrakech",
      location: {
        address: { street: "Semlaliya", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6180, longitude: -8.0150 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 1.5, walkingTime: 18 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 2800, deposit: 2800, utilities: 150, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: [], common: [], services: [] },
      status: "active"
    },
    {
      name: "Luxury Studio Gueliz",
      description: "High-end studio in the heart of Gueliz. Designer interior with premium amenities.",
      shortDescription: "Luxury studio in Gueliz, Marrakech",
      location: {
        address: { street: "Rue de la Liberté, Gueliz", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6350, longitude: -8.0080 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 3, walkingTime: 35 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 7000, deposit: 7000, utilities: 0, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom", "air_conditioning"], security: ["security_guard", "cctv", "keycard_access"], common: ["gym", "rooftop", "elevator"], services: ["cleaning_service", "24_7_support"] },
      status: "active"
    },
    {
      name: "Cozy Room Medina",
      description: "Charming room in the historic Medina. Experience traditional Marrakech architecture.",
      shortDescription: "Traditional room in Medina, Marrakech",
      location: {
        address: { street: "Medina", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.6295, longitude: -7.9811 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 4, walkingTime: 50 }]
      },
      propertyType: "private_room",
      pricing: { baseRent: 2200, deposit: 2200, utilities: 100, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "bathroom"], security: [], common: ["rooftop"], services: [] },
      status: "active"
    },
    {
      name: "Route Asfi Apartment",
      description: "Affordable apartment on Route Asfi. Good transport links to city center.",
      shortDescription: "Affordable on Route Asfi, Marrakech",
      location: {
        address: { street: "Route Asfi", city: "Marrakech", postalCode: "40000", country: "Morocco" },
        coordinates: { latitude: 31.5950, longitude: -8.0350 },
        nearbyUniversities: [{ name: "Universite Cadi Ayyad", distance: 4, walkingTime: 50 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 2500, deposit: 2500, utilities: 150, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: [], common: ["parking"], services: [] },
      status: "active"
    },

    // SALE DORMS
    {
      name: "Sale El Jadida Apartment",
      description: "New apartment in Sale El Jadida. Modern construction with easy access to Rabat via tramway.",
      shortDescription: "Modern apartment in Sale El Jadida",
      location: {
        address: { street: "Sale El Jadida", city: "Sale", postalCode: "11000", country: "Morocco" },
        coordinates: { latitude: 34.0550, longitude: -6.7980 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 6, walkingTime: 75 }]
      },
      propertyType: "apartment",
      pricing: { baseRent: 3000, deposit: 3000, utilities: 200, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "kitchen", "bathroom"], security: ["security_guard"], common: ["parking"], services: [] },
      status: "active"
    },
    {
      name: "Boutana Sale Studio",
      description: "Affordable studio in Boutana, Sale. Quiet neighborhood with good public transport.",
      shortDescription: "Budget studio in Boutana, Sale",
      location: {
        address: { street: "Boutana", city: "Sale", postalCode: "11000", country: "Morocco" },
        coordinates: { latitude: 34.0480, longitude: -6.8050 },
        nearbyUniversities: [{ name: "Universite Mohammed V De Rabat", distance: 5, walkingTime: 65 }]
      },
      propertyType: "studio",
      pricing: { baseRent: 2500, deposit: 2500, utilities: 150, currency: "MAD", billingCycle: "monthly" },
      amenities: { basic: ["wifi", "furnished", "bathroom"], security: [], common: [], services: [] },
      status: "active"
    }
  ];

  // Prepare dorms for insertion
  const dormsToInsert = dormsData.map(dorm => ({
    ...dorm,
    slug: generateSlug(dorm.name),
    landlord: landlord._id,
    images: [{ 
      url: `https://picsum.photos/seed/${generateSlug(dorm.name)}/800/600`, 
      isPrimary: true, 
      category: 'exterior' 
    }],
    roomTypes: [{
      type: dorm.propertyType === 'studio' ? 'studio' : dorm.propertyType === 'private_room' ? 'single' : 'apartment',
      price: dorm.pricing.baseRent,
      deposit: dorm.pricing.deposit,
      utilities: dorm.pricing.utilities,
      available: Math.floor(Math.random() * 5) + 1,
      total: Math.floor(Math.random() * 10) + 5,
      description: dorm.shortDescription
    }],
    availability: {
      isAvailable: true,
      moveInDate: new Date(),
      leaseTerms: ['6 months', '12 months']
    },
    averageRating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
    reviewCount: Math.floor(Math.random() * 50) + 5,
    totalReviews: Math.floor(Math.random() * 50) + 5,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  // Insert dorms
  try {
    await Dorm.insertMany(dormsToInsert);
    console.log(`✅ Seeded ${dormsToInsert.length} dorms successfully`);
    
    // Count by city
    const cities = {};
    dormsToInsert.forEach(dorm => {
      const city = dorm.location.address.city;
      cities[city] = (cities[city] || 0) + 1;
    });
    console.log('📍 Dorms by city:');
    Object.entries(cities).forEach(([city, count]) => {
      console.log(`   - ${city}: ${count} dorms`);
    });
  } catch (error) {
    console.error('Failed to seed dorms:', error.message);
  }
}

module.exports = {
  getMemoryDbUri,
  stopMemoryDb,
  seedAdminUser
};
