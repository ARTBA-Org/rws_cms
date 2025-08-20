import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import sharp from 'sharp'
import { CDN_CONFIG, validateCDNConfig } from './cdnConfig'
import { withRetry } from './retryUtils'

export interface ImageUploadOptions {
  moduleId: string
  filename: string
  generateResponsive?: boolean
  generateThumbnails?: boolean
  customPath?: string
  metadata?: Record<string, string>
  cacheControl?: string
}

export interface ImageUploadResult {
  success: boolean
  urls: {
    original: string
    thumbnail?: string
    sizes?: Record<number, string>
    formats?: Record<string, Record<number, string>>
  }
  metadata: {
    size: number
    dimensions: { width: number; height: number }
    format: string
    key: string
    bucket: string
    uploadedAt: number
  }
  errors?: string[]
}

export class S3ImageUploader {
  private s3Client: S3Client
  private cloudfrontClient?: CloudFrontClient
  private isConfigValid: boolean = false
  
  constructor() {
    // Validate configuration
    const validation = validateCDNConfig()
    if (!validation.valid) {
      console.error('❌ CDN configuration invalid:', validation.errors)
      throw new Error(`CDN configuration invalid: ${validation.errors.join(', ')}`)
    }
    
    this.isConfigValid = true
    
    // Initialize AWS clients
    this.s3Client = new S3Client({
      region: CDN_CONFIG.aws.region,
      credentials: CDN_CONFIG.aws.accessKeyId ? {
        accessKeyId: CDN_CONFIG.aws.accessKeyId,
        secretAccessKey: CDN_CONFIG.aws.secretAccessKey!,
        sessionToken: CDN_CONFIG.aws.sessionToken,
      } : undefined, // Use default credentials if not provided
    })
    
    if (CDN_CONFIG.cloudfront.distributionId) {
      this.cloudfrontClient = new CloudFrontClient({
        region: CDN_CONFIG.aws.region,
        credentials: CDN_CONFIG.aws.accessKeyId ? {
          accessKeyId: CDN_CONFIG.aws.accessKeyId,
          secretAccessKey: CDN_CONFIG.aws.secretAccessKey!,
          sessionToken: CDN_CONFIG.aws.sessionToken,
        } : undefined,
      })
    }
    
    console.log('📦 S3 Image Uploader initialized')
  }
  
  async uploadImage(
    imageBuffer: Buffer,
    options: ImageUploadOptions
  ): Promise<ImageUploadResult> {
    if (!this.isConfigValid) {
      throw new Error('CDN configuration is invalid')
    }
    
    try {
      // Validate image buffer
      const imageInfo = await sharp(imageBuffer).metadata()
      if (!imageInfo.width || !imageInfo.height) {
        throw new Error('Invalid image: could not determine dimensions')
      }
      
      // Sanitize filename
      const sanitizedFilename = this.sanitizeFilename(options.filename)
      const basePath = options.customPath || `modules/${options.moduleId}/images`
      const baseKey = `${basePath}/${sanitizedFilename}`
      
      const results: ImageUploadResult = {
        success: false,
        urls: { original: '' },
        metadata: {
          size: imageBuffer.length,
          dimensions: { width: imageInfo.width, height: imageInfo.height },
          format: imageInfo.format || 'unknown',
          key: baseKey,
          bucket: CDN_CONFIG.s3.bucketName,
          uploadedAt: Date.now(),
        },
      }
      
      const uploadPromises: Promise<any>[] = []
      const errors: string[] = []
      
      // Upload original image
      const originalKey = `${baseKey}.${imageInfo.format}`
      uploadPromises.push(
        this.uploadToS3(imageBuffer, originalKey, {
          contentType: `image/${imageInfo.format}`,
          metadata: options.metadata,
          cacheControl: options.cacheControl || 'public, max-age=31536000', // 1 year
        }).catch(err => {
          console.error('Failed to upload original:', err)
          errors.push(`Original upload failed: ${err.message}`)
        })
      )
      
      // Generate and upload thumbnail if requested
      if (options.generateThumbnails || CDN_CONFIG.upload.generateThumbnails) {
        try {
          const thumbnailBuffer = await sharp(imageBuffer)
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer()
          
          const thumbnailKey = `${baseKey}_thumb.jpeg`
          uploadPromises.push(
            this.uploadToS3(thumbnailBuffer, thumbnailKey, {
              contentType: 'image/jpeg',
              metadata: { ...options.metadata, variant: 'thumbnail' },
              cacheControl: options.cacheControl || 'public, max-age=31536000',
            }).then(() => {
              results.urls.thumbnail = `${this.getCDNUrl()}/${thumbnailKey}`
            }).catch(err => {
              console.error('Failed to upload thumbnail:', err)
              errors.push(`Thumbnail upload failed: ${err.message}`)
            })
          )
        } catch (err) {
          console.error('Failed to generate thumbnail:', err)
          errors.push(`Thumbnail generation failed: ${(err as Error).message}`)
        }
      }
      
      // Generate responsive variants if requested
      if (options.generateResponsive || CDN_CONFIG.images.enableResponsive) {
        results.urls.sizes = {}
        results.urls.formats = {}
        
        for (const size of CDN_CONFIG.images.sizes) {
          // Skip if image is smaller than target size
          if (imageInfo.width! < size) continue
          
          for (const format of CDN_CONFIG.images.formats) {
            for (const quality of CDN_CONFIG.images.qualities) {
              try {
                let sharpPipeline = sharp(imageBuffer).resize(size, null, { 
                  withoutEnlargement: true 
                })
                
                let outputBuffer: Buffer
                let contentType: string
                let fileExtension: string
                
                switch (format) {
                  case 'webp':
                    outputBuffer = await sharpPipeline.webp({ quality }).toBuffer()
                    contentType = 'image/webp'
                    fileExtension = 'webp'
                    break
                  case 'jpeg':
                    outputBuffer = await sharpPipeline.jpeg({ quality }).toBuffer()
                    contentType = 'image/jpeg'
                    fileExtension = 'jpg'
                    break
                  case 'png':
                    outputBuffer = await sharpPipeline.png({ 
                      quality: Math.round(quality * 0.9) // PNG quality is different
                    }).toBuffer()
                    contentType = 'image/png'
                    fileExtension = 'png'
                    break
                  default:
                    continue
                }
                
                const variantKey = `${baseKey}_${size}w_q${quality}.${fileExtension}`
                const cdnUrl = `${this.getCDNUrl()}/${variantKey}`
                
                // Initialize format object if needed
                if (!results.urls.formats![format]) {
                  results.urls.formats![format] = {}
                }
                
                results.urls.formats![format][size] = cdnUrl
                
                uploadPromises.push(
                  this.uploadToS3(outputBuffer, variantKey, {
                    contentType,
                    metadata: {
                      ...options.metadata,
                      variant: 'responsive',
                      size: size.toString(),
                      quality: quality.toString(),
                      format,
                    },
                    cacheControl: options.cacheControl || 'public, max-age=31536000',
                  }).catch(err => {
                    console.error(`Failed to upload ${format} ${size}w q${quality}:`, err)
                    errors.push(`${format} ${size}w q${quality} upload failed: ${err.message}`)
                  })
                )
                
                // Store the best quality version for sizes
                if (quality === Math.max(...CDN_CONFIG.images.qualities)) {
                  if (!results.urls.sizes) results.urls.sizes = {}
                  results.urls.sizes[size] = cdnUrl
                }
                
              } catch (err) {
                console.error(`Failed to generate ${format} ${size}w q${quality}:`, err)
                errors.push(`${format} ${size}w q${quality} generation failed: ${(err as Error).message}`)
              }
            }
          }
        }
      }
      
      // Wait for all uploads to complete
      await Promise.allSettled(uploadPromises)
      
      // Set original URL
      results.urls.original = `${this.getCDNUrl()}/${originalKey}`
      
      // Invalidate CloudFront cache if configured
      if (this.cloudfrontClient && CDN_CONFIG.cloudfront.distributionId) {
        try {
          await this.invalidateCloudFrontCache([`/${basePath}/*`])
        } catch (err) {
          console.warn('Failed to invalidate CloudFront cache:', err)
          errors.push(`CloudFront invalidation failed: ${(err as Error).message}`)
        }
      }
      
      results.success = errors.length === 0
      if (errors.length > 0) {
        results.errors = errors
        console.warn(`⚠️ Image upload completed with ${errors.length} errors:`, errors)
      }
      
      console.log(`✅ Image uploaded successfully: ${originalKey}`)
      return results
      
    } catch (error) {
      console.error('❌ Image upload failed:', error)
      throw error
    }
  }
  
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    options: {
      contentType: string
      metadata?: Record<string, string>
      cacheControl?: string
    }
  ): Promise<void> {
    return withRetry(
      async () => {
        const command = new PutObjectCommand({
          Bucket: CDN_CONFIG.s3.bucketName,
          Key: key,
          Body: buffer,
          ContentType: options.contentType,
          Metadata: options.metadata,
          CacheControl: options.cacheControl,
          ACL: CDN_CONFIG.s3.publicReadAccess ? 'public-read' : undefined,
        })
        
        await this.s3Client.send(command)
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        retryCondition: (error) => {
          // Retry on network errors and 5xx status codes
          return error.message.includes('NetworkingError') ||
                 error.message.includes('TimeoutError') ||
                 error.name === 'ServiceException'
        },
      }
    )
  }
  
  async deleteImage(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: CDN_CONFIG.s3.bucketName,
        Key: key,
      })
      
      await this.s3Client.send(command)
      
      // Invalidate CloudFront cache if configured
      if (this.cloudfrontClient && CDN_CONFIG.cloudfront.distributionId) {
        try {
          await this.invalidateCloudFrontCache([`/${key}`])
        } catch (err) {
          console.warn('Failed to invalidate CloudFront cache after deletion:', err)
        }
      }
      
      console.log(`🗑️  Image deleted: ${key}`)
      return true
      
    } catch (error) {
      console.error('❌ Failed to delete image:', error)
      return false
    }
  }
  
  async imageExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: CDN_CONFIG.s3.bucketName,
        Key: key,
      })
      
      await this.s3Client.send(command)
      return true
      
    } catch (error) {
      return false
    }
  }
  
  private async invalidateCloudFrontCache(paths: string[]): Promise<void> {
    if (!this.cloudfrontClient || !CDN_CONFIG.cloudfront.distributionId) {
      return
    }
    
    try {
      const command = new CreateInvalidationCommand({
        DistributionId: CDN_CONFIG.cloudfront.distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
          CallerReference: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        },
      })
      
      await this.cloudfrontClient.send(command)
      console.log(`🔄 CloudFront cache invalidated for paths:`, paths)
      
    } catch (error) {
      console.error('❌ CloudFront invalidation failed:', error)
      throw error
    }
  }
  
  private sanitizeFilename(filename: string): string {
    // Remove extension and sanitize
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    return nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
  
  private getCDNUrl(): string {
    if (CDN_CONFIG.cloudfront.customDomain) {
      return `https://${CDN_CONFIG.cloudfront.customDomain}`
    }
    
    if (CDN_CONFIG.cloudfront.domainName) {
      return `https://${CDN_CONFIG.cloudfront.domainName}`
    }
    
    // Fallback to S3 direct access
    return `https://${CDN_CONFIG.s3.bucketName}.s3.${CDN_CONFIG.s3.region}.amazonaws.com`
  }
}

// Export singleton instance
export const s3ImageUploader = new S3ImageUploader()