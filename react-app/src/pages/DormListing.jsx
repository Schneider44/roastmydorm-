import { useState, useMemo } from 'react'
import '../styles/DormListing.css'

/**
 * DormListing Component
 * Display dorms with filtering by city, price, and ratings
 * Mobile-responsive grid layout
 */
function DormListing() {
  // Sample dorm data - replace with API call later
  const allDorms = [
    {
      id: 1,
      name: "Cozy Room - Ain Sebaa",
      city: "Casablanca",
      price: 2500,
      rating: 4.5,
      reviews: 12,
      image: "/dorm-1.jpg",
      features: ["WiFi", "AC", "Furnished"]
    },
    {
      id: 2,
      name: "Modern Apartment - Hassan II",
      city: "Casablanca",
      price: 3000,
      rating: 4.8,
      reviews: 25,
      image: "/dorm-2.jpg",
      features: ["WiFi", "AC", "Parking"]
    },
    {
      id: 3,
      name: "Luxury Studio - Gueliz",
      city: "Marrakech",
      price: 3500,
      rating: 4.7,
      reviews: 18,
      image: "/dorm-3.jpg",
      features: ["WiFi", "Pool", "AC"]
    },
    {
      id: 4,
      name: "Student Residence - Rabat",
      city: "Rabat",
      price: 2000,
      rating: 4.3,
      reviews: 14,
      image: "/dorm-4.jpg",
      features: ["WiFi", "AC"]
    },
    {
      id: 5,
      name: "Executive Studio - Hay Riad",
      city: "Casablanca",
      price: 4000,
      rating: 4.9,
      reviews: 30,
      image: "/dorm-5.jpg",
      features: ["WiFi", "AC", "Parking", "Pool"]
    }
  ]

  // State for filters
  const [selectedCity, setSelectedCity] = useState('all')
  const [priceRange, setPriceRange] = useState([0, 5000])
  const [sortBy, setSortBy] = useState('price')

  // Filter and sort dorms
  const filteredDorms = useMemo(() => {
    let result = allDorms

    // Filter by city
    if (selectedCity !== 'all') {
      result = result.filter(d => d.city === selectedCity)
    }

    // Filter by price
    result = result.filter(d => d.price >= priceRange[0] && d.price <= priceRange[1])

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'newest') return b.id - a.id
      return 0
    })

    return result
  }, [selectedCity, priceRange, sortBy])

  const cities = ['all', ...new Set(allDorms.map(d => d.city))]

  return (
    <div className="dorm-listing-container">
      <div className="dorm-listing-header">
        <h1>Browse Dormitories</h1>
        <p>Find the perfect student home in Morocco</p>
      </div>

      <div className="dorm-listing-content">
        {/* Filters Sidebar */}
        <aside className="filters-sidebar">
          <h3>Filters</h3>

          {/* City Filter */}
          <div className="filter-group">
            <label>City</label>
            <select 
              value={selectedCity} 
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              {cities.map(city => (
                <option key={city} value={city}>
                  {city === 'all' ? 'All Cities' : city}
                </option>
              ))}
            </select>
          </div>

          {/* Price Filter */}
          <div className="filter-group">
            <label>Price Range: {priceRange[0]} - {priceRange[1]} DH</label>
            <input 
              type="range" 
              min="0" 
              max="5000" 
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
            />
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <label>Sort By</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="price">Price (Low to High)</option>
              <option value="rating">Rating (High to Low)</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </aside>

        {/* Dorms Grid */}
        <div className="dorms-main">
          <div className="results-info">
            <p>{filteredDorms.length} results found</p>
          </div>

          <div className="dorms-grid">
            {filteredDorms.map(dorm => (
              <div key={dorm.id} className="dorm-card">
                <div className="dorm-image">
                  <img src={dorm.image} alt={dorm.name} />
                  <div className="dorm-price">{dorm.price} DH</div>
                </div>

                <div className="dorm-info">
                  <h3>{dorm.name}</h3>
                  <p className="dorm-city">{dorm.city}</p>

                  <div className="dorm-rating">
                    <div className="rating-stars">
                      {'⭐'.repeat(Math.floor(dorm.rating))}
                    </div>
                    <span>{dorm.rating} ({dorm.reviews} reviews)</span>
                  </div>

                  <div className="dorm-features">
                    {dorm.features.map(feature => (
                      <span key={feature} className="feature-badge">
                        {feature}
                      </span>
                    ))}
                  </div>

                  <button className="view-details-btn">
                    View Details <i className="fas fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredDorms.length === 0 && (
            <div className="no-results">
              <i className="fas fa-search"></i>
              <p>No dorms found matching your filters</p>
              <button onClick={() => {
                setSelectedCity('all')
                setPriceRange([0, 5000])
              }}>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DormListing
