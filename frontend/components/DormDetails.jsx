import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Bed, 
  Wifi, 
  Utensils, 
  Car, 
  Shield, 
  Calendar, 
  Heart, 
  MessageCircle, 
  Share2,
  Star,
  Phone,
  Mail
} from 'lucide-react';

const DormDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dorm, setDorm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    // Fetch dorm details - replace with API call
    const fetchDormDetails = async () => {
      // Sample data - replace with actual API call
      const sampleDorm = {
        id: parseInt(id),
        title: "Modern Studio Near University",
        location: "Casablanca, Morocco",
        address: "123 Avenue Mohammed V, Casablanca 20000",
        price: 2500,
        roomType: "studio",
        amenities: ["wifi", "kitchen", "laundry", "security", "parking", "gym"],
        distance: "0.5km",
        photos: [
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"
        ],
        description: "Beautiful modern studio apartment located just 0.5km from the university campus. This fully furnished studio features a comfortable living space, modern kitchenette, and private bathroom. Perfect for students who want privacy and convenience.",
        landlord: {
          name: "Ahmed Benali",
          phone: "+212 6 12 34 56 78",
          email: "ahmed.benali@email.com",
          rating: 4.8,
          reviews: 24,
          verified: true
        },
        available: true,
        availableDates: "Available from September 2024",
        rules: [
          "No smoking allowed",
          "No pets",
          "Quiet hours after 10 PM",
          "No parties or loud music"
        ],
        nearby: [
          "University of Casablanca - 0.5km",
          "Supermarket - 0.2km",
          "Bus Stop - 0.1km",
          "Restaurant - 0.3km"
        ]
      };

      setDorm(sampleDorm);
      setLoading(false);
    };

    fetchDormDetails();
  }, [id]);

  const getAmenityIcon = (amenity) => {
    switch (amenity) {
      case 'wifi': return <Wifi className="w-5 h-5" />;
      case 'kitchen': return <Utensils className="w-5 h-5" />;
      case 'laundry': return <Car className="w-5 h-5" />;
      case 'security': return <Shield className="w-5 h-5" />;
      case 'parking': return <Car className="w-5 h-5" />;
      case 'gym': return <Shield className="w-5 h-5" />;
      default: return null;
    }
  };

  const getAmenityLabel = (amenity) => {
    switch (amenity) {
      case 'wifi': return 'Free Wi-Fi';
      case 'kitchen': return 'Kitchen Access';
      case 'laundry': return 'Laundry Facilities';
      case 'security': return '24/7 Security';
      case 'parking': return 'Parking Available';
      case 'gym': return 'Gym Access';
      default: return amenity;
    }
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => 
      prev === dorm.photos.length - 1 ? 0 : prev + 1
    );
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => 
      prev === 0 ? dorm.photos.length - 1 : prev - 1
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dorm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Dorm not found</h2>
          <button
            onClick={() => navigate('/for-rent')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Listings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/for-rent')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Listings
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFavorited(!isFavorited)}
                className={`p-2 rounded-full ${
                  isFavorited ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
              </button>
              <button className="p-2 bg-gray-100 text-gray-600 rounded-full">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Photo Gallery */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="relative">
                <img
                  src={dorm.photos[currentPhotoIndex]}
                  alt={dorm.title}
                  className="w-full h-96 object-cover"
                />
                {dorm.photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 p-2 rounded-full"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 p-2 rounded-full"
                    >
                      <ArrowLeft className="w-5 h-5 rotate-180" />
                    </button>
                  </>
                )}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                  {dorm.photos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPhotoIndex(index)}
                      className={`w-2 h-2 rounded-full ${
                        index === currentPhotoIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About this place</h2>
              <p className="text-gray-700 leading-relaxed">{dorm.description}</p>
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Amenities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {dorm.amenities.map(amenity => (
                  <div key={amenity} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {getAmenityIcon(amenity)}
                    <span className="text-gray-700">{getAmenityLabel(amenity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">House Rules</h2>
              <ul className="space-y-2">
                {dorm.rules.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-700">
                    <span className="text-red-500 mt-1">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* Nearby Places */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What's nearby</h2>
              <div className="space-y-3">
                {dorm.nearby.map((place, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{place}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price & Contact */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {dorm.price} MAD
                </div>
                <div className="text-gray-600">per month</div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-700">{dorm.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Bed className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-700 capitalize">{dorm.roomType} Room</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-700">{dorm.availableDates}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setShowContactModal(true)}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Contact Landlord
                </button>
                <button className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Schedule Visit
                </button>
              </div>
            </div>

            {/* Landlord Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Landlord</h3>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-lg">
                    {dorm.landlord.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{dorm.landlord.name}</h4>
                    {dorm.landlord.verified && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">
                      {dorm.landlord.rating} ({dorm.landlord.reviews} reviews)
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      {dorm.landlord.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      {dorm.landlord.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Landlord</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  defaultValue={`Inquiry about ${dorm.title}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  rows="4"
                  placeholder="Hi, I'm interested in this dorm..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DormDetails;
