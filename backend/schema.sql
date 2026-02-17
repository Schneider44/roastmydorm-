-- Database: ratemydorm (PostgreSQL recommended for scale and search)

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- LISTINGS TABLE
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    INDEX idx_location_city (location, city),
    INDEX idx_price (price),
    INDEX idx_status (status)
);

-- LISTING IMAGES
CREATE TABLE listing_images (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL
);

-- SEARCH OPTIMIZATION (GIN index for full-text search)
CREATE INDEX idx_listings_search ON listings USING GIN (to_tsvector('english', title || ' ' || description || ' ' || location || ' ' || city));

-- RANKING LOGIC (materialized view for fast search with ranking)
CREATE MATERIALIZED VIEW ranked_listings AS
SELECT l.*, 
    (CASE WHEN l.is_premium AND l.premium_until > NOW() THEN 100 ELSE 0 END) +
    (EXTRACT(EPOCH FROM (NOW() - l.created_at))/86400 * -1) AS rank_score
FROM listings l
WHERE l.status = 'active';

CREATE INDEX idx_ranked_listings_rank_score ON ranked_listings (rank_score DESC);

-- PAYMENTS (future-proof)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- FILTERING (city, price, premium, recency)
-- Example query for search:
-- SELECT * FROM ranked_listings WHERE city = 'Rabat' AND price BETWEEN 1000 AND 3000 ORDER BY rank_score DESC LIMIT 20;
