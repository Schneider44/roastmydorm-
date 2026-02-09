const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Author
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Categories & Tags
  category: {
    type: String,
    enum: [
      'housing-guides',
      'cost-of-living',
      'dorm-comparisons',
      'university-advice',
      'city-guides',
      'student-life',
      'roommate-tips',
      'moving-tips',
      'reviews'
    ],
    required: true
  },
  tags: [String],
  
  // SEO Metadata
  seo: {
    metaTitle: {
      type: String,
      maxlength: 70
    },
    metaDescription: {
      type: String,
      maxlength: 160
    },
    canonicalUrl: String,
    keywords: [String],
    ogImage: String,
    ogTitle: String,
    ogDescription: String
  },
  
  // Media
  featuredImage: {
    url: String,
    alt: String,
    caption: String
  },
  images: [{
    url: String,
    alt: String,
    caption: String
  }],
  
  // Internal Linking
  relatedDorms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm'
  }],
  relatedCities: [String],
  relatedUniversities: [String],
  relatedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlogPost'
  }],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  
  // Analytics
  views: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  readTime: { type: Number, default: 0 }, // in minutes
  
  // Engagement
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Indexes
blogPostSchema.index({ slug: 1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ tags: 1 });
blogPostSchema.index({ 'seo.keywords': 1 });
blogPostSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Generate slug from title
blogPostSchema.statics.generateSlug = function(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Calculate read time based on content
blogPostSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    const wordsPerMinute = 200;
    const wordCount = this.content.split(/\s+/).length;
    this.readTime = Math.ceil(wordCount / wordsPerMinute);
  }
  
  // Auto-generate SEO fields if not provided
  if (!this.seo.metaTitle) {
    this.seo.metaTitle = this.title.substring(0, 70);
  }
  if (!this.seo.metaDescription) {
    this.seo.metaDescription = this.excerpt.substring(0, 160);
  }
  if (!this.seo.ogTitle) {
    this.seo.ogTitle = this.title;
  }
  if (!this.seo.ogDescription) {
    this.seo.ogDescription = this.excerpt;
  }
  
  next();
});

// Virtual for URL
blogPostSchema.virtual('url').get(function() {
  return `/blog/${this.slug}`;
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
