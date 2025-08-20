import type { Browser, Page } from 'puppeteer-core'
import { PDF_CONFIG } from './pdfConfig'

interface BrowserInstance {
  browser: Browser
  inUse: boolean
  created: number
  lastUsed: number
  pageCount: number
}

interface PoolConfig {
  minInstances: number
  maxInstances: number
  maxPageCount: number
  maxIdleTime: number // milliseconds
  maxInstanceAge: number // milliseconds
}

class BrowserPool {
  private pool: BrowserInstance[] = []
  private config: PoolConfig
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      minInstances: 1,
      maxInstances: 3,
      maxPageCount: 10, // Restart browser after 10 pages to prevent memory leaks
      maxIdleTime: 5 * 60 * 1000, // 5 minutes
      maxInstanceAge: 30 * 60 * 1000, // 30 minutes
      ...config,
    }

    this.startCleanup()
  }

  private async launchBrowser(): Promise<Browser> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
    ]

    const headless = PDF_CONFIG.chromeHeadless

    // Try puppeteer first (bundled Chromium), then puppeteer-core
    let puppeteerModule: any
    let useCore = false

    try {
      puppeteerModule = await import('puppeteer')
      console.log('🧭 Using puppeteer for browser pool (bundled Chromium)')
    } catch {
      puppeteerModule = await import('puppeteer-core')
      useCore = true
      console.log('🧭 Using puppeteer-core for browser pool (external Chromium)')
    }

    let executablePath: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH

    if (useCore && !executablePath) {
      try {
        const chromium = await import('@sparticuz/chromium')
        executablePath = await chromium.executablePath()
        console.log('🧭 Using @sparticuz/chromium executable for browser pool')
      } catch (error) {
        console.warn('⚠️ @sparticuz/chromium not available, using system Chrome for browser pool')
      }
    }

    const launchOptions: any = {
      headless,
      args,
      ignoreDefaultArgs: ['--disable-extensions'],
    }

    if (executablePath) {
      launchOptions.executablePath = executablePath
    }

    return await puppeteerModule.launch(launchOptions)
  }

  async getBrowser(): Promise<Browser> {
    // Try to find an available browser
    let available = this.pool.find(instance => 
      !instance.inUse && 
      instance.pageCount < this.config.maxPageCount &&
      Date.now() - instance.created < this.config.maxInstanceAge
    )

    if (available) {
      available.inUse = true
      available.lastUsed = Date.now()
      console.log(`🏊 Reusing browser from pool (${this.pool.length} total, ${this.getInUseCount()} in use)`)
      return available.browser
    }

    // Create new browser if under limit
    if (this.pool.length < this.config.maxInstances) {
      console.log(`🚀 Creating new browser for pool (${this.pool.length + 1}/${this.config.maxInstances})`)
      const browser = await this.launchBrowser()
      
      const instance: BrowserInstance = {
        browser,
        inUse: true,
        created: Date.now(),
        lastUsed: Date.now(),
        pageCount: 0,
      }

      this.pool.push(instance)
      return browser
    }

    // Wait for an available browser (with timeout)
    console.log('⏳ Waiting for available browser in pool...')
    const timeout = 10000 // 10 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      available = this.pool.find(instance => !instance.inUse)
      if (available) {
        available.inUse = true
        available.lastUsed = Date.now()
        console.log(`🏊 Got available browser after waiting`)
        return available.browser
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    throw new Error('Browser pool timeout: no available browsers')
  }

  async releaseBrowser(browser: Browser): Promise<void> {
    const instance = this.pool.find(inst => inst.browser === browser)
    if (instance) {
      instance.inUse = false
      instance.pageCount++
      console.log(`🏊 Released browser to pool (used ${instance.pageCount}/${this.config.maxPageCount} times)`)

      // Close browser if it's reached max page count or age
      if (instance.pageCount >= this.config.maxPageCount || 
          Date.now() - instance.created >= this.config.maxInstanceAge) {
        await this.removeBrowser(instance)
      }
    }
  }

  async createPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage()
    
    // Set reasonable defaults
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    return page
  }

  private async removeBrowser(instance: BrowserInstance): Promise<void> {
    try {
      if (!instance.browser.process()?.killed) {
        await instance.browser.close()
      }
    } catch (error) {
      console.warn('⚠️ Error closing browser:', error)
    }

    this.pool = this.pool.filter(inst => inst !== instance)
    console.log(`🗑️ Removed browser from pool (${this.pool.length} remaining)`)
  }

  private getInUseCount(): number {
    return this.pool.filter(inst => inst.inUse).length
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000) // Clean every minute
  }

  private async cleanup(): Promise<void> {
    const now = Date.now()
    const toRemove: BrowserInstance[] = []

    for (const instance of this.pool) {
      // Remove idle browsers beyond min count
      if (!instance.inUse && 
          this.pool.length > this.config.minInstances &&
          now - instance.lastUsed > this.config.maxIdleTime) {
        toRemove.push(instance)
      }
      
      // Remove aged browsers
      if (!instance.inUse && now - instance.created > this.config.maxInstanceAge) {
        toRemove.push(instance)
      }

      // Remove browsers that have processed too many pages
      if (!instance.inUse && instance.pageCount >= this.config.maxPageCount) {
        toRemove.push(instance)
      }
    }

    for (const instance of toRemove) {
      await this.removeBrowser(instance)
    }

    if (toRemove.length > 0) {
      console.log(`🧹 Cleaned up ${toRemove.length} browsers from pool`)
    }
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down browser pool...')
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    const shutdownPromises = this.pool.map(instance => 
      instance.browser.close().catch(err => 
        console.warn('⚠️ Error during browser shutdown:', err)
      )
    )

    await Promise.all(shutdownPromises)
    this.pool = []
    console.log('✅ Browser pool shutdown complete')
  }

  getStats() {
    return {
      total: this.pool.length,
      inUse: this.getInUseCount(),
      available: this.pool.length - this.getInUseCount(),
      config: this.config,
    }
  }
}

// Export singleton instance
export const browserPool = new BrowserPool({
  minInstances: 1,
  maxInstances: Number(process.env.BROWSER_POOL_MAX_INSTANCES) || 3,
  maxPageCount: Number(process.env.BROWSER_POOL_MAX_PAGE_COUNT) || 10,
  maxIdleTime: Number(process.env.BROWSER_POOL_MAX_IDLE_TIME) || 5 * 60 * 1000,
  maxInstanceAge: Number(process.env.BROWSER_POOL_MAX_INSTANCE_AGE) || 30 * 60 * 1000,
})

// Graceful shutdown
process.on('SIGTERM', () => {
  browserPool.shutdown()
})

process.on('SIGINT', () => {
  browserPool.shutdown()
})