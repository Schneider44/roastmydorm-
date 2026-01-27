import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bed, Wifi, Utensils, Car, Shield, Star, Heart, Eye } from 'lucide-react';

const ForStudents = () => {
  const [selectedCity, setSelectedCity] = useState(null);
  const [dorms, setDorms] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const cities = [
    {
      id: 'casablanca',
      name: 'Casablanca',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
      description: 'Morocco\'s economic capital with modern universities',
      dormCount: 45
    },
    {
      id: 'rabat',
      name: 'Rabat',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
      description: 'Capital city with prestigious universities',
      dormCount: 32
    },
    {
      id: 'marrakech',
      name: 'Marrakech',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
      description: 'Historic city with growing student population',
      dormCount: 28
    }
  ];

  // Sample dorm data - replace with API call
  const sampleDorms = {
    casablanca: [
      {
        id: 1,
        title: "Modern Studio Near Hassan II University",
        location: "Ain Diab, Casablanca",
        price: 2800,
        roomType: "studio",
        amenities: ["wifi", "kitchen", "laundry", "security"],
        rating: 4.5,
        reviews: 23,
        photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400"],
        available: true
      },
      {
        id: 2,
        title: "Shared Apartment - 2 Bedrooms",
        location: "Maarif, Casablanca",
        price: 2200,
        roomType: "shared",
        amenities: ["wifi", "kitchen", "laundry"],
        rating: 4.2,
        reviews: 18,
        photos: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400"],
        available: true
      },
      {
        id: 3,
        title: "Single Room in Student House",
        location: "Hay Riad, Casablanca",
        price: 1800,
        roomType: "single",
        amenities: ["wifi", "security"],
        rating: 4.0,
        reviews: 15,
        photos: ["https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400"],
        available: true
      }
    ],
    rabat: [
      {
        id: 4,
        title: "Cozy Studio Near Mohammed V University",
        location: "Agdal, Rabat",
        price: 2500,
        roomType: "studio",
        amenities: ["wifi", "kitchen", "laundry", "security"],
        rating: 4.6,
        reviews: 31,
        photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400"],
        available: true
      },
      {
        id: 5,
        title: "Shared Room - 3 Bedrooms",
        location: "Hassan, Rabat",
        price: 2000,
        roomType: "shared",
        amenities: ["wifi", "kitchen"],
        rating: 4.3,
        reviews: 22,
        photos: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400"],
        available: true
      }
    ],
    marrakech: [
      {
        id: 6,
        title: "Traditional Riad Student Room",
        location: "Gueliz, Marrakech",
        price: 2100,
        roomType: "single",
        amenities: ["wifi", "kitchen", "security"],
        rating: 4.4,
        reviews: 19,
        photos: ["https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400"],
        available: true
      },
      {
        id: 7,
        title: "Modern Studio Near Cadi Ayyad University",
        location: "Semlalia, Marrakech",
        price: 2400,
        roomType: "studio",
        amenities: ["wifi", "kitchen", "laundry", "security", "ac"],
        rating: 4.7,
        reviews: 27,
        photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400"],
        available: true
      }
    ]
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setDorms(sampleDorms[city.id] || []);
      setLoading(false);
    }, 500);
  };

  const handleDormClick = (dormId) => {
    navigate(`/student-dorm/${dormId}`);
  };

  const getAmenityIcon = (amenity) => {
    switch (amenity) {
      case 'wifi': return <Wifi className="w-4 h-4" />;
      case 'kitchen': return <Utensils className="w-4 h-4" />;
      case 'laundry': return <Car className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      case 'ac': return <Shield className="w-4 h-4" />;
      default: return null;
    }
  };

  const getRoomTypeIcon = (roomType) => {
    return <Bed className="w-4 h-4" />;
  };

  if (!selectedCity) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Student Home</h1>
            <p className="text-gray-600">Choose your city to discover available dorms</p>
          </div>
        </div>

        {/* City Selection */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cities.map(city => (
              <div
                key={city.id}
                onClick={() => handleCitySelect(city)}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden group"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={city.image}
                    alt={city.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-2xl font-bold mb-1">{city.name}</h3>
                    <p className="text-sm opacity-90">{city.dormCount} dorms available</p>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4">{city.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {city.dormCount} properties
                    </span>
                    <div className="flex items-center text-blue-600 font-medium">
                      Browse Dorms
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedCity(null)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Cities
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedCity.name} Dorms</h1>
                <p className="text-gray-600">{dorms.length} dorms available</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dorms Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {dorms.map(dorm => (
              <div
                key={dorm.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
              >
                <div className="relative">
                  <img
                    src={dorm.photos[0]}
                    alt={dorm.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <button className="p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors">
                      <Heart className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Available
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                      {dorm.title}
                    </h3>
                    <span className="text-2xl font-bold text-blue-600">
                      {dorm.price} MAD
                    </span>
                  </div>

                  <div className="flex items-center text-gray-600 mb-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span className="text-sm">{dorm.location}</span>
                  </div>

                  <div className="flex items-center text-gray-600 mb-4">
                    {getRoomTypeIcon(dorm.roomType)}
                    <span className="text-sm ml-1 capitalize">{dorm.roomType} Room</span>
                    <span className="mx-2">•</span>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                      <span className="text-sm">{dorm.rating}</span>
                      <span className="text-sm text-gray-500 ml-1">({dorm.reviews})</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {dorm.amenities.slice(0, 3).map(amenity => (
                      <span key={amenity} className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {getAmenityIcon(amenity)}
                        {amenity}
                      </span>
                    ))}
                    {dorm.amenities.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{dorm.amenities.length - 3} more
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDormClick(dorm.id)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && dorms.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Bed className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No dorms found</h3>
            <p className="text-gray-600">No dorms are currently available in {selectedCity.name}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForStudents;
