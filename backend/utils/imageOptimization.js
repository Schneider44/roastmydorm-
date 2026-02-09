/**
 * Image optimization utilities for RoastMyDorm
 */

const sharp = require('sharp');
const path = require('path');

/**
 * Supported image formats
 */
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif'];

/**
 * Image size presets
 */
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320, height: 240 },
  medium: { width: 640, height: 480 },
  large: { width: 1024, height: 768 },
  hero: { width: 1920, height: 1080 }
};

/**
 * Optimize image buffer and convert to WebP
 */
const optimizeImage = async (buffer, options = {}) => {
  const {
    width,
    height,
    quality = 80,
    format = 'webp',
    fit = 'cover'
  } = options;

  let image = sharp(buffer);

  // Get image metadata
  const metadata = await image.metadata();

  // Resize if dimensions provided
  if (width || height) {
    image = image.resize(width, height, {
      fit,
      withoutEnlargement: true
    });
  }

  // Convert to specified format
  switch (format) {
    case 'webp':
      image = image.webp({ quality });
      break;
    case 'jpeg':
    case 'jpg':
      image = image.jpeg({ quality, progressive: true });
      break;
    case 'png':
      image = image.png({ compressionLevel: 9 });
      break;
    default:
      image = image.webp({ quality });
  }

  return {
    buffer: await image.toBuffer(),
    format,
    originalFormat: metadata.format,
    originalWidth: metadata.width,
    originalHeight: metadata.height
  };
};

/**
 * Generate responsive image set
 */
const generateResponsiveImages = async (buffer, baseName) => {
  const results = {};

  for (const [sizeName, dimensions] of Object.entries(IMAGE_SIZES)) {
    const { buffer: optimizedBuffer, format } = await optimizeImage(buffer, {
      ...dimensions,
      format: 'webp'
    });

    results[sizeName] = {
      buffer: optimizedBuffer,
      filename: `${baseName}-${sizeName}.webp`,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  return results;
};

/**
 * Generate srcset string for responsive images
 */
const generateSrcSet = (imageUrl, sizes = ['small', 'medium', 'large']) => {
  const baseName = imageUrl.replace(/\.[^.]+$/, '');
  return sizes
    .map(size => {
      const width = IMAGE_SIZES[size]?.width;
      if (!width) return null;
      return `${baseName}-${size}.webp ${width}w`;
    })
    .filter(Boolean)
    .join(', ');
};

/**
 * Generate lazy loading HTML attributes
 */
const generateLazyLoadAttrs = (src, alt, options = {}) => {
  const {
    width,
    height,
    className = '',
    sizes = '100vw',
    srcset
  } = options;

  return {
    src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // Tiny placeholder
    'data-src': src,
    'data-srcset': srcset || generateSrcSet(src),
    alt,
    loading: 'lazy',
    decoding: 'async',
    class: `lazyload ${className}`.trim(),
    width,
    height,
    sizes
  };
};

/**
 * Get image dimensions from URL
 */
const getImageDimensions = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: metadata.size
  };
};

/**
 * Create placeholder blur hash
 */
const createBlurPlaceholder = async (buffer) => {
  const { data, info } = await sharp(buffer)
    .resize(20, 20, { fit: 'inside' })
    .blur(5)
    .toBuffer({ resolveWithObject: true });

  return `data:image/${info.format};base64,${data.toString('base64')}`;
};

/**
 * Validate image format and size
 */
const validateImage = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedFormats = SUPPORTED_FORMATS
  } = options;

  const errors = [];

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  // Check format
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (!allowedFormats.includes(ext)) {
    errors.push(`Format not supported. Allowed: ${allowedFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  optimizeImage,
  generateResponsiveImages,
  generateSrcSet,
  generateLazyLoadAttrs,
  getImageDimensions,
  createBlurPlaceholder,
  validateImage,
  IMAGE_SIZES,
  SUPPORTED_FORMATS
};
