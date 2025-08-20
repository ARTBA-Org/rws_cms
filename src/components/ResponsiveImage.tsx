'use client'

import React, { useState, useEffect } from 'react'
import { getCDNBaseUrl, generateResponsiveImageUrls } from '../utils/cdnConfig'

export interface ResponsiveImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  sizes?: string
  quality?: number
  priority?: boolean
  loading?: 'eager' | 'lazy'
  onLoad?: () => void
  onError?: (error: Error) => void
  // CDN-specific props
  cdnUrls?: {
    original: string
    thumbnail?: string
    sizes?: Record<number, string>
    formats?: Record<string, Record<number, string>>
  }
  fallbackSrc?: string
  enableWebP?: boolean
  enableLazyLoading?: boolean
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  quality = 85,
  priority = false,
  loading = 'lazy',
  onLoad,
  onError,
  cdnUrls,
  fallbackSrc,
  enableWebP = true,
  enableLazyLoading = true,
}) => {
  const [imageError, setImageError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [webPSupported, setWebPSupported] = useState<boolean | null>(null)

  // Check WebP support
  useEffect(() => {
    const checkWebPSupport = async () => {
      if (!enableWebP) {
        setWebPSupported(false)
        return
      }

      try {
        // Create a tiny WebP image to test support
        const webp = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
        const img = new Image()
        
        img.onload = () => {
          setWebPSupported(img.width === 2 && img.height === 2)
        }
        
        img.onerror = () => {
          setWebPSupported(false)
        }
        
        img.src = webp
      } catch {
        setWebPSupported(false)
      }
    }

    checkWebPSupport()
  }, [enableWebP])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    if (!imageError) {
      setImageError(true)
      if (fallbackSrc) {
        onError?.(new Error('Primary image failed, trying fallback'))
      } else {
        onError?.(new Error('Image failed to load'))
      }
    }
  }

  // Generate sources for different formats and sizes
  const generateSources = () => {
    if (!cdnUrls?.formats) return null

    const sources: JSX.Element[] = []

    // WebP sources (if supported and enabled)
    if (webPSupported && cdnUrls.formats.webp) {
      const webpSrcSet = Object.entries(cdnUrls.formats.webp)
        .map(([size, url]) => `${url} ${size}w`)
        .join(', ')
      
      sources.push(
        <source
          key="webp"
          srcSet={webpSrcSet}
          sizes={sizes}
          type="image/webp"
        />
      )
    }

    // JPEG sources
    if (cdnUrls.formats.jpeg) {
      const jpegSrcSet = Object.entries(cdnUrls.formats.jpeg)
        .map(([size, url]) => `${url} ${size}w`)
        .join(', ')
      
      sources.push(
        <source
          key="jpeg"
          srcSet={jpegSrcSet}
          sizes={sizes}
          type="image/jpeg"
        />
      )
    }

    // PNG sources (fallback)
    if (cdnUrls.formats.png) {
      const pngSrcSet = Object.entries(cdnUrls.formats.png)
        .map(([size, url]) => `${url} ${size}w`)
        .join(', ')
      
      sources.push(
        <source
          key="png"
          srcSet={pngSrcSet}
          sizes={sizes}
          type="image/png"
        />
      )
    }

    return sources
  }

  // Determine the best source URL
  const getImageSrc = () => {
    if (imageError && fallbackSrc) {
      return fallbackSrc
    }

    // Use CDN URLs if available
    if (cdnUrls) {
      // Try WebP first if supported
      if (webPSupported && cdnUrls.formats?.webp) {
        const webpSizes = Object.keys(cdnUrls.formats.webp).map(Number).sort((a, b) => b - a)
        const bestSize = webpSizes.find(size => !width || size >= width) || webpSizes[0]
        return cdnUrls.formats.webp[bestSize]
      }

      // Fallback to original
      return cdnUrls.original
    }

    return src
  }

  const imageSrc = getImageSrc()
  const shouldUseLazyLoading = enableLazyLoading && !priority && loading === 'lazy'
  const sources = generateSources()

  // Show loading placeholder while WebP support is being checked
  if (webPSupported === null && enableWebP) {
    return (
      <div 
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ width, height }}
      >
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <picture className={className}>
      {sources}
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        loading={shouldUseLazyLoading ? 'lazy' : 'eager'}
        decoding={priority ? 'sync' : 'async'}
        onLoad={handleLoad}
        onError={handleError}
        className={`
          ${isLoaded ? 'opacity-100' : 'opacity-0'} 
          transition-opacity duration-300
          ${className}
        `}
        style={{
          maxWidth: '100%',
          height: 'auto',
          objectFit: 'cover',
        }}
        // Add native lazy loading attributes
        {...(shouldUseLazyLoading && {
          loading: 'lazy',
          'data-loading': 'lazy',
        })}
      />
      
      {/* Loading overlay */}
      {!isLoaded && !imageError && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center"
          style={{ width, height }}
        >
          <div className="text-gray-400">Loading...</div>
        </div>
      )}
      
      {/* Error overlay */}
      {imageError && !fallbackSrc && (
        <div 
          className="absolute inset-0 bg-red-50 flex items-center justify-center border border-red-200"
          style={{ width, height }}
        >
          <div className="text-red-400 text-sm text-center p-2">
            Image failed to load
          </div>
        </div>
      )}
    </picture>
  )
}

// Hook for using CDN images
export const useCDNImage = (
  originalSrc: string,
  basePath?: string,
  filename?: string
) => {
  const [cdnUrls, setCdnUrls] = useState<ResponsiveImageProps['cdnUrls']>()

  useEffect(() => {
    if (basePath && filename) {
      // Extract filename without extension
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
      const extension = filename.split('.').pop() || 'jpg'
      
      const urls = generateResponsiveImageUrls(basePath, nameWithoutExt, extension)
      setCdnUrls(urls)
    }
  }, [originalSrc, basePath, filename])

  return {
    cdnUrls,
    isLoading: !cdnUrls && Boolean(basePath && filename),
  }
}

// Utility component for PDF slide images
export interface PDFSlideImageProps {
  slideId: string | number
  pdfFilename: string
  pageNumber: number
  moduleId: string
  alt?: string
  className?: string
  width?: number
  height?: number
  priority?: boolean
}

export const PDFSlideImage: React.FC<PDFSlideImageProps> = ({
  slideId,
  pdfFilename,
  pageNumber,
  moduleId,
  alt,
  className,
  width = 800,
  height,
  priority = false,
}) => {
  const baseFilename = pdfFilename.replace('.pdf', '')
  const imageName = `${baseFilename}_page_${pageNumber}`
  const basePath = `modules/${moduleId}/pdfs/${baseFilename}`
  const fallbackSrc = `/api/slides/${slideId}/image`

  const { cdnUrls, isLoading } = useCDNImage(
    fallbackSrc,
    basePath,
    `${imageName}.webp`
  )

  return (
    <ResponsiveImage
      src={fallbackSrc}
      alt={alt || `Page ${pageNumber} from ${pdfFilename}`}
      width={width}
      height={height}
      className={className}
      priority={priority}
      cdnUrls={cdnUrls}
      fallbackSrc={fallbackSrc}
      enableWebP={true}
      enableLazyLoading={!priority}
    />
  )
}

export default ResponsiveImage