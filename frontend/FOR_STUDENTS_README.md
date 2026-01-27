# For Students - Student Housing Platform

This document describes the "For Students" section of the RoastMyDorm platform, designed specifically for students to find housing in major Moroccan cities.

## Features

### 1. City Selection Page
- **Three Major Cities**: Casablanca, Rabat, Marrakech
- **Beautiful City Cards**: Each city has an attractive card with:
  - City image
  - City name and description
  - Number of available dorms
  - Hover effects and animations

### 2. Dorm Listings by City
- **Grid Layout**: Responsive grid showing available dorms
- **Dorm Cards**: Each card displays:
  - Dorm photo thumbnail
  - Dorm title and location
  - Price per month (in MAD)
  - Room type (single/shared/studio)
  - Star rating and review count
  - Key amenities (Wi-Fi, kitchen, laundry, etc.)
  - "View Details" button

### 3. Detailed Dorm Page
- **Photo Gallery**: Multiple photos with carousel navigation
- **Complete Information**:
  - Detailed description
  - Full amenities list with icons
  - House rules
  - Nearby places and distances
  - Landlord contact information
- **Payment Options**:
  - **Credit Card**: "Pay by Credit Card (direct to landlord)"
  - **Face-to-Face**: "Pay Face to Face" with instructions
  - **Clear Disclaimer**: "All payments are arranged directly between student and landlord. RoastMyDorm is not responsible for financial transactions."

## Technical Implementation

### Frontend Components

#### ForStudents.jsx
- City selection interface
- Dorm listings grid
- Search and filter functionality
- Responsive design with Tailwind CSS

#### StudentDormDetails.jsx
- Detailed dorm view
- Photo carousel
- Payment options selection
- Contact landlord modal
- Save to favorites functionality

### Backend API

#### StudentDorm Model
```javascript
{
  city: String, // 'casablanca', 'rabat', 'marrakech'
  title: String,
  description: String,
  price: Number,
  location: String,
  address: String,
  roomType: String, // 'single', 'shared', 'studio'
  amenities: [String],
  photos: [String],
  rules: [String],
  availableDates: String,
  landlordId: ObjectId,
  landlord: {
    name: String,
    phone: String,
    email: String,
    verified: Boolean
  },
  status: String, // 'available', 'rented', 'unavailable'
  views: Number,
  inquiries: Number,
  rating: Number,
  reviews: Number,
  nearby: [String],
  paymentOptions: [{
    id: String,
    title: String,
    description: String,
    note: String
  }]
}
```

#### API Endpoints
- `GET /api/student-dorms?city=casablanca` - Get dorms by city
- `GET /api/student-dorms/:id` - Get single dorm details
- `POST /api/student-dorms` - Create new dorm (landlord only)
- `PUT /api/student-dorms/:id` - Update dorm (landlord only)
- `DELETE /api/student-dorms/:id` - Delete dorm (landlord only)
- `GET /api/student-dorms/landlord/:landlordId` - Get landlord's dorms
- `POST /api/student-dorms/:id/inquiry` - Submit inquiry
- `GET /api/student-dorms/cities/stats` - Get city statistics

## Usage Flow

### For Students
1. **Visit "For Students"** from main navigation
2. **Select City** from the three available options
3. **Browse Dorms** in the selected city
4. **View Details** by clicking on any dorm card
5. **Review Information** including photos, amenities, and rules
6. **Choose Payment Option** (credit card or face-to-face)
7. **Contact Landlord** to arrange viewing and payment

### For Landlords
1. **Register/Login** as a landlord
2. **Create Dorm Listing** with city selection
3. **Add Photos** and detailed information
4. **Set Payment Options** (default options provided)
5. **Manage Listings** through landlord dashboard

## Design Features

### Student-Friendly Design
- **Clean Interface**: Simple, intuitive navigation
- **Visual Hierarchy**: Clear information organization
- **Mobile Responsive**: Works on all device sizes
- **Fast Loading**: Optimized images and components

### Payment Integration
- **No Payment Processing**: Platform does not handle payments
- **Clear Disclaimers**: Transparent about payment responsibility
- **Multiple Options**: Credit card and face-to-face options
- **Landlord Contact**: Direct communication for payment arrangements

### City-Specific Features
- **Casablanca**: Economic capital with modern universities
- **Rabat**: Capital city with prestigious institutions
- **Marrakech**: Historic city with growing student population

## Security & Privacy

### Data Protection
- **No Payment Data**: Platform doesn't store payment information
- **Secure Communication**: Landlord contact through platform
- **User Verification**: Landlord verification system
- **Privacy Controls**: User data protection

### Financial Safety
- **Clear Disclaimers**: Users understand payment responsibility
- **Direct Communication**: Students and landlords arrange payments
- **No Platform Fees**: No hidden charges or fees
- **Transparent Process**: Clear about platform limitations

## Future Enhancements

### Planned Features
- **Map Integration**: Show dorms on city maps
- **Advanced Filters**: More filtering options
- **Reviews System**: Student reviews and ratings
- **Favorites**: Save preferred dorms
- **Notifications**: Alert for new dorms in selected cities
- **Mobile App**: Native mobile application

### Technical Improvements
- **Real-time Updates**: Live availability updates
- **Image Optimization**: Better photo handling
- **Search Enhancement**: Improved search algorithms
- **Performance**: Faster loading times
- **Analytics**: Usage tracking and insights

## Getting Started

### For Developers
1. **Install Dependencies**: `npm run install-all`
2. **Setup Environment**: Configure MongoDB and JWT secret
3. **Run Application**: `npm run dev`
4. **Access Platform**: http://localhost:3000

### For Students
1. **Visit Platform**: Go to RoastMyDorm.com
2. **Click "For Students"**: From main navigation
3. **Select Your City**: Choose from available options
4. **Browse Dorms**: View available housing
5. **Contact Landlords**: Arrange viewings and payments

### For Landlords
1. **Register Account**: Create landlord account
2. **Add Property**: Use landlord dashboard
3. **Select City**: Choose from available cities
4. **Upload Photos**: Add property images
5. **Set Details**: Add description, amenities, rules
6. **Publish Listing**: Make it available to students

## Support

For technical support or questions about the "For Students" section:
- **Email**: support@roastmydorm.com
- **Documentation**: Check this README
- **Issues**: Report bugs through GitHub issues
- **Community**: Join our student community forum
