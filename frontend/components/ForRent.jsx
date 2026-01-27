import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Bed, Wifi, Car, Utensils, Shield, Calendar, Heart, Eye } from 'lucide-react';

const ForRent = () => {
  const [dorms, setDorms] = useState([]);
  const [filteredDorms, setFilteredDorms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    priceRange: [0, 5000],
    roomType: 'all',
    amenities: [],
    distance: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Sample data - replace with API call
  useEffect(() => {
    const sampleDorms = [
      {
        id: 1,
        title: "Modern Studio Near University",
        location: "Casablanca, Morocco",
        price: 2500,
        roomType: "studio",
        amenities: ["wifi", "kitchen", "laundry", "security"],
        distance: "0.5km",
        photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400"],
        description: "Beautiful modern studio with all amenities",
        landlord: "Ahmed Benali",
        available: true
      },
      {
        id: 2,
        title: "Shared Apartment - 2 Bedrooms",
        location: "Rabat, Morocco",
        price: 1800,
        roomType: "shared",
        amenities: ["wifi", "kitchen", "laundry"],
        distance: "1.2km",
        photos: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400"],
        description: "Spacious shared apartment near campus",
        landlord: "Fatima Alami",
        available: true
      },
      {
        id: 3,
        title: "Single Room in Student House",
        location: "Marrakech, Morocco",
        price: 1200,
        roomType: "single",
        amenities: ["wifi", "security"],
        distance: "2.1km",
        photos: ["https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400"],
        description: "Cozy single room in student-friendly house",
        landlord: "Omar Tazi",
        available: true
      }
    ];
    
    setDorms(sampleDorms);
    setFilteredDorms(sampleDorms);
    setLoading(false);
  }, []);

  // Filter dorms based on current filters
  useEffect(() => {
    let filtered = dorms.filter(dorm => {
      // Search filter
      if (filters.search && !dorm.title.toLowerCase().includes(filters.search.toLowerCase()) && 
          !dorm.location.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Price range filter
      if (dorm.price < filters.priceRange[0] || dorm.price > filters.priceRange[1]) {
        return false;
      }

      // Room type filter
      if (filters.roomType !== 'all' && dorm.roomType !== filters.roomType) {
        return false;
      }

      // Amenities filter
      if (filters.amenities.length > 0) {
        const hasAllAmenities = filters.amenities.every(amenity => 
          dorm.amenities.includes(amenity)
        );
        if (!hasAllAmenities) return false;
      }

      return true;
    });

    setFilteredDorms(filtered);
  }, [dorms, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleAmenityToggle = (amenity) => {
    setFilters(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const getRoomTypeIcon = (roomType) => {
    switch (roomType) {
      case 'studio': return <Bed className="w-4 h-4" />;
      case 'shared': return <Bed className="w-4 h-4" />;
      case 'single': return <Bed className="w-4 h-4" />;
      default: return <Bed className="w-4 h-4" />;
    }
  };

  const getAmenityIcon = (amenity) => {
    switch (amenity) {
      case 'wifi': return <Wifi className="w-4 h-4" />;
      case 'kitchen': return <Utensils className="w-4 h-4" />;
      case 'laundry': return <Car className="w-4 h-4" />;
      case 'security': return <Shield className="w-4 h-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Perfect Dorm</h1>
          <p className="text-gray-600">Browse available student housing across Morocco</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 text-blue-600"
                >
                  <Filter className="w-4 h-4" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </button>
              </div>

              <div className={`space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="City, university, dorm name..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range: {filters.priceRange[0]} - {filters.priceRange[1]} MAD/month
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={filters.priceRange[0]}
                      onChange={(e) => handleFilterChange('priceRange', [parseInt(e.target.value), filters.priceRange[1]])}
                      className="w-full"
                    />
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={filters.priceRange[1]}
                      onChange={(e) => handleFilterChange('priceRange', [filters.priceRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Room Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Type
                  </label>
                  <select
                    value={filters.roomType}
                    onChange={(e) => handleFilterChange('roomType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="single">Single Room</option>
                    <option value="shared">Shared Room</option>
                    <option value="studio">Studio</option>
                  </select>
                </div>

                {/* Amenities */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amenities
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'wifi', label: 'Wi-Fi' },
                      { key: 'kitchen', label: 'Kitchen' },
                      { key: 'laundry', label: 'Laundry' },
                      { key: 'security', label: 'Security' }
                    ].map(amenity => (
                      <label key={amenity.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={filters.amenities.includes(amenity.key)}
                          onChange={() => handleAmenityToggle(amenity.key)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{amenity.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Distance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distance to University
                  </label>
                  <select
                    value={filters.distance}
                    onChange={(e) => handleFilterChange('distance', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Any Distance</option>
                    <option value="<1km">Less than 1km</option>
                    <option value="<3km">Less than 3km</option>
                    <option value="<5km">Less than 5km</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Dorms Grid */}
          <div className="lg:w-3/4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {filteredDorms.length} dorms available
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDorms.map(dorm => (
                <div key={dorm.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
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
                      <span className="text-sm">{dorm.distance} from university</span>
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

                    <div className="flex gap-2">
                      <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredDorms.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Search className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No dorms found</h3>
                <p className="text-gray-600">Try adjusting your filters or search terms</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForRent;
