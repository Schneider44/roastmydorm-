/**
 * Simple in-memory cache with TTL support
 * For production, consider using Redis instead
 */
class MemoryCache {
  constructor(defaultTTL = 300) { // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL * 1000; // Convert to milliseconds
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get value from cache
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set value in cache
   */
  set(key, value, ttlSeconds = null) {
    const ttl = (ttlSeconds || this.defaultTTL / 1000) * 1000;
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  /**
   * Delete specific key
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Delete keys matching pattern
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern);
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Close cache (cleanup interval)
   */
  close() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Singleton instance
const cache = new MemoryCache();

/**
 * Express middleware for caching GET requests
 */
const cacheMiddleware = (ttlSeconds = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `route:${req.originalUrl}`;
    const cachedData = cache.get(key);

    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data, ttlSeconds);
      }
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
};

/**
 * Invalidate cache for specific patterns
 */
const invalidateCache = (pattern) => {
  return cache.deletePattern(pattern);
};

/**
 * Cache decorator for async functions
 */
const cached = (keyPrefix, ttlSeconds = 300) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      const cachedResult = cache.get(key);

      if (cachedResult !== null) {
        return cachedResult;
      }

      const result = await originalMethod.apply(this, args);
      cache.set(key, result, ttlSeconds);
      return result;
    };

    return descriptor;
  };
};

module.exports = {
  cache,
  cacheMiddleware,
  invalidateCache,
  cached,
  MemoryCache
};
