import type { CacheKey, CachedSlideData } from '../types/pdfTypes'
import { PDF_CONFIG } from './pdfConfig'

// Simple in-memory cache as fallback when Redis is not available
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    
    return item.data as T
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expires = Date.now() + (ttlSeconds * 1000)
    this.cache.set(key, { data: value, expires })
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async flushAll(): Promise<void> {
    this.cache.clear()
  }

  // Cleanup expired entries periodically
  private cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
  }

  constructor() {
    // Cleanup every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }
}

// Redis client wrapper (optional dependency)
class RedisCache {
  private client: any = null
  private connected = false

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      // Dynamic import to avoid requiring Redis as a hard dependency
      const redis = await import('redis')
      
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING
      if (!redisUrl) {
        console.warn('⚠️ Redis URL not configured, falling back to memory cache')
        return
      }

      this.client = redis.createClient({ url: redisUrl })
      
      this.client.on('error', (err: any) => {
        console.error('❌ Redis connection error:', err)
        this.connected = false
      })

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis')
        this.connected = true
      })

      await this.client.connect()
    } catch (error) {
      console.warn('⚠️ Redis not available, using memory cache:', (error as Error).message)
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) return null

    try {
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.warn('⚠️ Redis get error:', error)
      return null
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.connected || !this.client) return

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      console.warn('⚠️ Redis set error:', error)
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected || !this.client) return

    try {
      await this.client.del(key)
    } catch (error) {
      console.warn('⚠️ Redis del error:', error)
    }
  }

  async flushAll(): Promise<void> {
    if (!this.connected || !this.client) return

    try {
      await this.client.flushAll()
    } catch (error) {
      console.warn('⚠️ Redis flush error:', error)
    }
  }
}

// Cache interface
interface CacheInterface {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: any, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  flushAll(): Promise<void>
}

// Cache manager
class CacheManager {
  private cache: CacheInterface
  private enabled: boolean

  constructor() {
    this.enabled = PDF_CONFIG.enableCaching
    
    if (!this.enabled) {
      console.log('📦 PDF caching is disabled')
      this.cache = new MemoryCache() // Still create a cache for potential use
      return
    }

    console.log('📦 Initializing PDF cache...')
    
    // Try Redis first, fallback to memory cache
    if (process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING) {
      this.cache = new RedisCache()
    } else {
      console.log('📦 Using in-memory cache (Redis not configured)')
      this.cache = new MemoryCache()
    }
  }

  private getCacheKey(key: CacheKey): string {
    return `pdf:${key.moduleId}:${key.pdfFilename}:${key.pageNum}`
  }

  async getCachedSlide(key: CacheKey): Promise<CachedSlideData | null> {
    if (!this.enabled) return null

    try {
      return await this.cache.get<CachedSlideData>(this.getCacheKey(key))
    } catch (error) {
      console.warn('⚠️ Cache get error:', error)
      return null
    }
  }

  async setCachedSlide(key: CacheKey, data: Omit<CachedSlideData, 'cached' | 'cacheTimestamp'>): Promise<void> {
    if (!this.enabled) return

    try {
      const cacheData: CachedSlideData = {
        ...data,
        cached: true,
        cacheTimestamp: Date.now(),
      }
      
      const ttlSeconds = PDF_CONFIG.cacheExpireHours * 60 * 60
      await this.cache.set(this.getCacheKey(key), cacheData, ttlSeconds)
    } catch (error) {
      console.warn('⚠️ Cache set error:', error)
    }
  }

  async invalidateSlide(key: CacheKey): Promise<void> {
    if (!this.enabled) return

    try {
      await this.cache.del(this.getCacheKey(key))
    } catch (error) {
      console.warn('⚠️ Cache invalidation error:', error)
    }
  }

  async invalidateModule(moduleId: string): Promise<void> {
    if (!this.enabled) return

    try {
      // For Redis, we would need to scan for keys with pattern
      // For memory cache, we can iterate through keys
      // This is a simplified implementation
      console.log(`🧹 Cache invalidation for module ${moduleId} - not fully implemented`)
    } catch (error) {
      console.warn('⚠️ Module cache invalidation error:', error)
    }
  }

  async clearAll(): Promise<void> {
    try {
      await this.cache.flushAll()
      console.log('🧹 All PDF cache cleared')
    } catch (error) {
      console.warn('⚠️ Cache clear error:', error)
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager()