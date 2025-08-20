export interface CDNConfig {
  // AWS Configuration
  aws: {
    region: string
    accessKeyId?: string
    secretAccessKey?: string
    sessionToken?: string
  }
  
  // S3 Configuration
  s3: {
    bucketName: string
    region: string
    publicReadAccess: boolean
    corsEnabled: boolean
    versioning: boolean
  }
  
  // CloudFront Configuration  
  cloudfront: {
    distributionId?: string
    domainName?: string
    customDomain?: string
    cacheBehaviors: {
      images: {
        pathPattern: string
        cachePolicyId?: string
        ttl: number
      }
    }
  }
  
  // Image Processing
  images: {
    formats: ('webp' | 'png' | 'jpeg')[]
    qualities: number[]
    sizes: number[]
    enableResponsive: boolean
    enableLazyLoading: boolean
  }
  
  // Upload Configuration
  upload: {
    maxFileSize: number
    allowedMimeTypes: string[]
    generateThumbnails: boolean
    enableMetadata: boolean
  }
}

export const CDN_CONFIG: CDNConfig = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
  
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'rws-cms-images',
    region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
    publicReadAccess: process.env.S3_PUBLIC_READ === 'true',
    corsEnabled: process.env.S3_CORS_ENABLED !== 'false',
    versioning: process.env.S3_VERSIONING === 'true',
  },
  
  cloudfront: {
    distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    domainName: process.env.CLOUDFRONT_DOMAIN_NAME,
    customDomain: process.env.CLOUDFRONT_CUSTOM_DOMAIN,
    cacheBehaviors: {
      images: {
        pathPattern: '/images/*',
        cachePolicyId: process.env.CLOUDFRONT_CACHE_POLICY_ID,
        ttl: parseInt(process.env.CLOUDFRONT_IMAGE_TTL || '86400', 10), // 1 day default
      },
    },
  },
  
  images: {
    formats: (process.env.CDN_IMAGE_FORMATS?.split(',') as ('webp' | 'png' | 'jpeg')[]) || ['webp', 'png'],
    qualities: process.env.CDN_IMAGE_QUALITIES?.split(',').map(q => parseInt(q, 10)) || [85, 70, 50],
    sizes: process.env.CDN_IMAGE_SIZES?.split(',').map(s => parseInt(s, 10)) || [400, 800, 1200, 1600],
    enableResponsive: process.env.CDN_RESPONSIVE_IMAGES !== 'false',
    enableLazyLoading: process.env.CDN_LAZY_LOADING !== 'false',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.CDN_MAX_FILE_SIZE || '10485760', 10), // 10MB default
    allowedMimeTypes: process.env.CDN_ALLOWED_TYPES?.split(',') || [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/gif',
    ],
    generateThumbnails: process.env.CDN_GENERATE_THUMBNAILS !== 'false',
    enableMetadata: process.env.CDN_ENABLE_METADATA !== 'false',
  },
}

// Environment variable validation
export function validateCDNConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Required AWS configuration
  if (!CDN_CONFIG.aws.region) {
    errors.push('AWS_REGION is required')
  }
  
  // S3 configuration
  if (!CDN_CONFIG.s3.bucketName) {
    errors.push('S3_BUCKET_NAME is required')
  }
  
  // CloudFront configuration (optional but recommended)
  if (!CDN_CONFIG.cloudfront.distributionId && !CDN_CONFIG.cloudfront.domainName) {
    console.warn('⚠️  CloudFront not configured. Images will be served directly from S3.')
  }
  
  // Image configuration
  if (CDN_CONFIG.images.formats.length === 0) {
    errors.push('At least one image format must be specified')
  }
  
  if (CDN_CONFIG.images.qualities.some(q => q < 1 || q > 100)) {
    errors.push('Image qualities must be between 1-100')
  }
  
  if (CDN_CONFIG.images.sizes.some(s => s < 1 || s > 4000)) {
    errors.push('Image sizes must be between 1-4000 pixels')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// Helper to get CDN URL
export function getCDNBaseUrl(): string {
  if (CDN_CONFIG.cloudfront.customDomain) {
    return `https://${CDN_CONFIG.cloudfront.customDomain}`
  }
  
  if (CDN_CONFIG.cloudfront.domainName) {
    return `https://${CDN_CONFIG.cloudfront.domainName}`
  }
  
  // Fallback to S3 direct access
  return `https://${CDN_CONFIG.s3.bucketName}.s3.${CDN_CONFIG.s3.region}.amazonaws.com`
}

// Generate responsive image URLs
export function generateResponsiveImageUrls(
  basePath: string,
  filename: string,
  extension: string
): {
  original: string
  sizes: Record<number, string>
  formats: Record<string, Record<number, string>>
} {
  const baseUrl = getCDNBaseUrl()
  const baseKey = `${basePath}/${filename}`
  
  const original = `${baseUrl}/${baseKey}.${extension}`
  
  const sizes: Record<number, string> = {}
  const formats: Record<string, Record<number, string>> = {}
  
  // Generate size variants
  CDN_CONFIG.images.sizes.forEach(size => {
    sizes[size] = `${baseUrl}/${baseKey}_${size}w.${extension}`
  })
  
  // Generate format variants
  CDN_CONFIG.images.formats.forEach(format => {
    formats[format] = {}
    CDN_CONFIG.images.sizes.forEach(size => {
      formats[format][size] = `${baseUrl}/${baseKey}_${size}w.${format}`
    })
  })
  
  return { original, sizes, formats }
}