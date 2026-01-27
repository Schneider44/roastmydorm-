# RoastMyDorm - Student Housing Platform

A comprehensive platform for students to find, rate, and rent dormitories across Morocco, with tools for landlords to manage their listings.

## Features

### For Students
- **Browse Dorms**: Search and filter available student housing
- **Advanced Filters**: Filter by price, room type, amenities, distance to university
- **Detailed Listings**: View photos, descriptions, amenities, and landlord information
- **Reviews & Ratings**: Read and write reviews about dorm experiences
- **Favorites**: Save preferred dorms for later
- **Contact Landlords**: Direct messaging with property owners

### For Landlords
- **List Properties**: Easy-to-use dashboard for posting dorm listings
- **Manage Listings**: Edit, update, and delete property information
- **Analytics**: Track views, inquiries, and performance
- **Photo Management**: Upload multiple photos for each listing
- **Student Communication**: Respond to inquiries and messages

## Tech Stack

### Frontend
- **React 18** - Modern UI library
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client for API calls

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing

## Project Structure

```
roastmydorm/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ForRent.jsx
│   │   │   ├── DormDetails.jsx
│   │   │   └── LandlordDashboard.jsx
│   │   ├── App.jsx          # Main app component
│   │   ├── index.js         # Entry point
│   │   └── index.css        # Global styles
│   ├── package.json
│   └── tailwind.config.js
├── backend/                  # Node.js backend
│   ├── models/              # MongoDB models
│   │   ├── Dorm.js
│   │   └── User.js
│   ├── routes/              # API routes
│   │   ├── dorms.js
│   │   └── auth.js
│   ├── middleware/          # Custom middleware
│   │   └── auth.js
│   ├── server.js            # Express server
│   └── package.json
├── package.json             # Root package.json
└── README.md
```

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd roastmydorm
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install all dependencies (frontend + backend)
npm run install-all
```

### 3. Environment Setup

#### Backend Environment
Create a `.env` file in the `backend` directory:
```bash
cd backend
cp env.example .env
```

Edit the `.env` file with your configuration:
```env
MONGODB_URI=mongodb://localhost:27017/ratemydorm
JWT_SECRET=your-super-secret-jwt-key-here
PORT=5000
NODE_ENV=development
```

### 4. Database Setup
Make sure MongoDB is running on your system:
```bash
# Start MongoDB (if installed locally)
mongod
```

### 5. Run the Application

#### Development Mode (Both Frontend & Backend)
```bash
npm run dev
```

#### Run Separately
```bash
# Backend only
npm run server

# Frontend only
npm run client
```

### 6. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Dorms
- `GET /api/dorms` - Get all dorms (with filters)
- `GET /api/dorms/:id` - Get single dorm details
- `POST /api/dorms` - Create new dorm (landlord only)
- `PUT /api/dorms/:id` - Update dorm (landlord only)
- `DELETE /api/dorms/:id` - Delete dorm (landlord only)
- `GET /api/dorms/landlord/:landlordId` - Get landlord's dorms
- `POST /api/dorms/:id/inquiry` - Submit inquiry

## Usage

### For Students
1. **Browse Dorms**: Visit the "For Rent" section to see available dorms
2. **Filter Results**: Use the sidebar filters to narrow down your search
3. **View Details**: Click on any dorm card to see full details
4. **Contact Landlord**: Use the contact form to reach out to property owners
5. **Save Favorites**: Click the heart icon to save dorms you like

### For Landlords
1. **Sign Up**: Register as a landlord
2. **List Property**: Use the "List Property" section to add new dorms
3. **Manage Listings**: Edit, update, or delete your existing listings
4. **Track Performance**: Monitor views and inquiries for each listing

## Features in Detail

### Search & Filtering
- **Text Search**: Search by dorm name, location, or description
- **Price Range**: Filter by minimum and maximum price
- **Room Type**: Single, shared, or studio rooms
- **Amenities**: Wi-Fi, kitchen, laundry, security, etc.
- **Distance**: Filter by proximity to university

### Dorm Listings
- **Photo Gallery**: Multiple photos with carousel navigation
- **Detailed Information**: Description, amenities, rules, nearby places
- **Landlord Contact**: Direct communication with property owners
- **Availability Calendar**: Check when rooms are available
- **Reviews & Ratings**: Student feedback and ratings

### Landlord Dashboard
- **Property Management**: Add, edit, and delete listings
- **Photo Upload**: Multiple photos per listing
- **Analytics**: Track views, inquiries, and performance
- **Communication**: Respond to student inquiries

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@ratemydorm.com or create an issue in the repository.

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced search with map integration
- [ ] Payment integration
- [ ] Video tours
- [ ] Multi-language support
- [ ] Push notifications
- [ ] Advanced analytics dashboard