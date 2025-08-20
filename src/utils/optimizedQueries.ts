import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Optimized database queries specifically for PDF processing workloads.
 * These queries use the performance indexes created by the optimization scripts
 * and implement caching strategies to reduce database load.
 */

export interface SlideExistsOptions {
  moduleId: string | number
  pdfFilename: string
  pdfPage: number
  useCache?: boolean
}

export interface BulkSlideData {
  title: string
  description?: string
  type?: string
  moduleId: string | number
  pdfFilename: string
  pdfPage: number
  imageId?: string | number
}

export interface ModuleSlideStats {
  moduleId: string | number
  totalSlides: number
  slidesLast24h: number
  slidesLastWeek: number
  lastSlideCreated: string | null
  uniquePdfsProcessed: number
  avgPageNumber: number
  maxPageNumber: number
}

// In-memory cache for frequently accessed data
const queryCache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 300000 // 5 minutes

class OptimizedQueries {
  private static instance: OptimizedQueries
  private payload: any = null

  static getInstance(): OptimizedQueries {
    if (!OptimizedQueries.instance) {
      OptimizedQueries.instance = new OptimizedQueries()
    }
    return OptimizedQueries.instance
  }

  private async getPayloadInstance() {
    if (!this.payload) {
      this.payload = await getPayload({ config })
    }
    return this.payload
  }

  // Check if slide exists with optimized query
  async slideExists(options: SlideExistsOptions): Promise<boolean> {
    const { moduleId, pdfFilename, pdfPage, useCache = true } = options
    const cacheKey = `slide_exists:${moduleId}:${pdfFilename}:${pdfPage}`

    // Check cache first
    if (useCache) {
      const cached = this.getCachedResult(cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    try {
      const payload = await this.getPayloadInstance()

      // Use optimized query with the idx_slides_source_lookup index
      const result = await payload.find({
        collection: 'slides',
        where: {
          and: [
            { 'source.module': { equals: String(moduleId) } },
            { 'source.pdfFilename': { equals: pdfFilename } },
            { 'source.pdfPage': { equals: pdfPage } },
            { _status: { not_equals: 'archived' } },
          ],
        },
        limit: 1,
        depth: 0, // Don't populate relationships
      })

      const exists = result.docs.length > 0

      // Cache the result
      if (useCache) {
        this.setCachedResult(cacheKey, exists)
      }

      return exists

    } catch (error) {
      console.error('Error checking slide existence:', error)
      return false
    }
  }

  // Get slides for a module with optimized pagination
  async getModuleSlides(
    moduleId: string | number,
    options: {
      page?: number
      limit?: number
      sortBy?: 'created' | 'page' | 'title'
      sortOrder?: 'asc' | 'desc'
      includeImages?: boolean
      useCache?: boolean
    } = {}
  ): Promise<{ slides: any[]; totalCount: number; hasMore: boolean }> {
    const {
      page = 1,
      limit = 50,
      sortBy = 'page',
      sortOrder = 'asc',
      includeImages = false,
      useCache = true,
    } = options

    const cacheKey = `module_slides:${moduleId}:${page}:${limit}:${sortBy}:${sortOrder}:${includeImages}`

    // Check cache for frequently accessed module slides
    if (useCache && page === 1) {
      const cached = this.getCachedResult(cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    try {
      const payload = await this.getPayloadInstance()

      // Determine sort field
      let sort: string
      switch (sortBy) {
        case 'created':
          sort = sortOrder === 'desc' ? '-createdAt' : 'createdAt'
          break
        case 'page':
          sort = sortOrder === 'desc' ? '-source.pdfPage' : 'source.pdfPage'
          break
        case 'title':
          sort = sortOrder === 'desc' ? '-title' : 'title'
          break
        default:
          sort = 'source.pdfPage'
      }

      // Use optimized query with idx_slides_module_relationship index
      const result = await payload.find({
        collection: 'slides',
        where: {
          and: [
            { 'source.module': { equals: String(moduleId) } },
            { _status: { not_equals: 'archived' } },
          ],
        },
        sort,
        limit,
        page,
        depth: includeImages ? 1 : 0, // Only populate image if needed
      })

      const response = {
        slides: result.docs,
        totalCount: result.totalDocs,
        hasMore: result.hasNextPage,
      }

      // Cache first page results for frequently accessed modules
      if (useCache && page === 1) {
        this.setCachedResult(cacheKey, response)
      }

      return response

    } catch (error) {
      console.error('Error fetching module slides:', error)
      return { slides: [], totalCount: 0, hasMore: false }
    }
  }

  // Bulk create slides with optimized batch processing
  async bulkCreateSlides(slidesData: BulkSlideData[]): Promise<(string | number)[]> {
    if (slidesData.length === 0) {
      return []
    }

    try {
      const payload = await this.getPayloadInstance()
      const createdIds: (string | number)[] = []

      // Process in batches to avoid overwhelming the database
      const batchSize = 10
      const batches = []

      for (let i = 0; i < slidesData.length; i += batchSize) {
        batches.push(slidesData.slice(i, i + batchSize))
      }

      console.log(`📦 Processing ${slidesData.length} slides in ${batches.length} batches`)

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} slides)`)

        // Create promises for concurrent processing within batch
        const batchPromises = batch.map(async (slideData) => {
          try {
            // Check if slide already exists before creating
            const exists = await this.slideExists({
              moduleId: slideData.moduleId,
              pdfFilename: slideData.pdfFilename,
              pdfPage: slideData.pdfPage,
              useCache: false, // Don't use cache during bulk creation
            })

            if (exists) {
              console.log(`⚠️ Slide already exists: ${slideData.pdfFilename} page ${slideData.pdfPage}`)
              return null
            }

            const slide = await payload.create({
              collection: 'slides',
              data: {
                title: slideData.title,
                description: slideData.description,
                type: slideData.type || 'regular',
                source: {
                  module: String(slideData.moduleId),
                  pdfFilename: slideData.pdfFilename,
                  pdfPage: slideData.pdfPage,
                },
                image: slideData.imageId ? String(slideData.imageId) : undefined,
              },
              depth: 0, // Don't populate relationships for performance
            })

            return slide.id

          } catch (error) {
            console.error(`❌ Failed to create slide: ${slideData.title}`, error)
            return null
          }
        })

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        const validIds = batchResults.filter(id => id !== null) as (string | number)[]
        createdIds.push(...validIds)

        console.log(`✅ Batch ${batchIndex + 1} completed: ${validIds.length}/${batch.length} slides created`)

        // Small delay between batches to prevent overwhelming the database
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // Clear any cached slide existence checks for this module
      this.clearCacheByPattern(`slide_exists:${slidesData[0].moduleId}:`)

      console.log(`🎉 Bulk creation completed: ${createdIds.length}/${slidesData.length} slides created`)
      return createdIds

    } catch (error) {
      console.error('Error in bulk slide creation:', error)
      return []
    }
  }

  // Update module slides array efficiently
  async updateModuleSlides(
    moduleId: string | number,
    slideIds: (string | number)[],
    operation: 'add' | 'remove' | 'replace' = 'add'
  ): Promise<boolean> {
    try {
      const payload = await this.getPayloadInstance()

      // Get current module with minimal data
      const currentModule = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
        depth: 0,
      })

      if (!currentModule) {
        throw new Error(`Module ${moduleId} not found`)
      }

      let updatedSlides: (string | number)[]

      switch (operation) {
        case 'add':
          const existingSlides = Array.isArray(currentModule.slides)
            ? currentModule.slides.map((s: any) => typeof s === 'object' ? s.id : s)
            : []
          updatedSlides = Array.from(new Set([...existingSlides, ...slideIds]))
          break

        case 'remove':
          const currentSlides = Array.isArray(currentModule.slides)
            ? currentModule.slides.map((s: any) => typeof s === 'object' ? s.id : s)
            : []
          updatedSlides = currentSlides.filter((id: any) => !slideIds.includes(id))
          break

        case 'replace':
          updatedSlides = slideIds
          break

        default:
          throw new Error(`Invalid operation: ${operation}`)
      }

      // Update the module with new slides array
      await payload.update({
        collection: 'modules',
        id: String(moduleId),
        data: {
          slides: updatedSlides,
        },
        depth: 0, // Don't return populated relationships
      })

      // Clear related cache
      this.clearCacheByPattern(`module_slides:${moduleId}:`)

      console.log(`✅ Module ${moduleId} slides updated: ${operation} ${slideIds.length} slides`)
      return true

    } catch (error) {
      console.error('Error updating module slides:', error)
      return false
    }
  }

  // Get processing statistics for modules
  async getProcessingStats(moduleIds?: (string | number)[]): Promise<ModuleSlideStats[]> {
    const cacheKey = `processing_stats:${moduleIds?.join(',') || 'all'}`
    const cached = this.getCachedResult(cacheKey)

    if (cached !== null) {
      return cached
    }

    try {
      const payload = await this.getPayloadInstance()

      // Build where clause
      const whereClause: any = {
        _status: { not_equals: 'archived' },
      }

      if (moduleIds && moduleIds.length > 0) {
        whereClause.id = { in: moduleIds.map(id => String(id)) }
      }

      // Get modules with slide counts
      const modules = await payload.find({
        collection: 'modules',
        where: whereClause,
        limit: 0, // Get all matching modules
        depth: 0,
      })

      const stats: ModuleSlideStats[] = []

      for (const module of modules.docs) {
        // Get slide statistics for this module
        const slideStats = await payload.find({
          collection: 'slides',
          where: {
            and: [
              { 'source.module': { equals: String(module.id) } },
              { _status: { not_equals: 'archived' } },
            ],
          },
          limit: 0,
          depth: 0,
        })

        const now = new Date()
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const slides24h = slideStats.docs.filter(s => new Date(s.createdAt) > last24h).length
        const slidesWeek = slideStats.docs.filter(s => new Date(s.createdAt) > lastWeek).length

        const pdfFilenames = new Set(slideStats.docs.map(s => s.source?.pdfFilename).filter(Boolean))
        const pageNumbers = slideStats.docs.map(s => s.source?.pdfPage).filter(n => typeof n === 'number')

        const lastCreated = slideStats.docs.length > 0
          ? slideStats.docs.reduce((latest, slide) =>
            new Date(slide.createdAt) > new Date(latest.createdAt) ? slide : latest
          ).createdAt
          : null

        stats.push({
          moduleId: module.id,
          totalSlides: slideStats.docs.length,
          slidesLast24h: slides24h,
          slidesLastWeek: slidesWeek,
          lastSlideCreated: lastCreated,
          uniquePdfsProcessed: pdfFilenames.size,
          avgPageNumber: pageNumbers.length > 0 ? pageNumbers.reduce((a, b) => a + b, 0) / pageNumbers.length : 0,
          maxPageNumber: pageNumbers.length > 0 ? Math.max(...pageNumbers) : 0,
        })
      }

      // Cache the results
      this.setCachedResult(cacheKey, stats)

      return stats

    } catch (error) {
      console.error('Error fetching processing stats:', error)
      return []
    }
  }

  // Cache management methods
  private getCachedResult<T>(key: string): T | null {
    const cached = queryCache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
    queryCache.delete(key)
    return null
  }

  private setCachedResult(key: string, data: any): void {
    queryCache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL,
    })
  }

  private clearCacheByPattern(pattern: string): void {
    for (const [key] of queryCache) {
      if (key.startsWith(pattern)) {
        queryCache.delete(key)
      }
    }
  }

  // Clear all cached results
  clearCache(): void {
    queryCache.clear()
  }

  // Get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: queryCache.size,
      keys: Array.from(queryCache.keys()),
    }
  }
}

// Export singleton instance
export const optimizedQueries = OptimizedQueries.getInstance()

// Helper functions for common operations
export async function checkSlideExists(
  moduleId: string | number,
  pdfFilename: string,
  pdfPage: number
): Promise<boolean> {
  return optimizedQueries.slideExists({
    moduleId,
    pdfFilename,
    pdfPage,
  })
}

export async function getModuleSlidesOptimized(
  moduleId: string | number,
  options?: {
    limit?: number
    sortBy?: 'created' | 'page' | 'title'
    includeImages?: boolean
  }
): Promise<any[]> {
  const result = await optimizedQueries.getModuleSlides(moduleId, options)
  return result.slides
}

export async function createSlidesInBatches(
  slidesData: BulkSlideData[]
): Promise<(string | number)[]> {
  return optimizedQueries.bulkCreateSlides(slidesData)
}

export async function addSlidesToModule(
  moduleId: string | number,
  slideIds: (string | number)[]
): Promise<boolean> {
  return optimizedQueries.updateModuleSlides(moduleId, slideIds, 'add')
}