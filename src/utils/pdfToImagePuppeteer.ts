// Dynamically resolve a Chromium binary for both local and serverless environments
// Prefer puppeteer if available, otherwise fall back to puppeteer-core + @sparticuz/chromium
import type { Browser } from 'puppeteer-core'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { existsSync } from 'fs'
import path from 'path'
import { withRetry, isRetryablePuppeteerError } from './retryUtils'
import { PDF_CONFIG } from './pdfConfig'
import { browserPool } from './browserPool'

/**
 * Convert a single-page PDF buffer to a high-DPI PNG using Puppeteer.
 * Strategy:
 * - Read page size from PDF (points)
 * - Compute pixel size at target DPI (default 300), with sane max clamp
 * - Render a minimal HTML with an <embed> filling the viewport exactly
 * - Screenshot only the visible area (no toolbars/margins), PNG (lossless)
 */
export async function convertPDFPageToImage(
    pdfBuffer: Buffer,
    pageNum: number = 1,
    opts?: { dpi?: number; maxDimension?: number; format?: 'png' | 'webp'; quality?: number }
): Promise<Buffer | null> {
    let browser: Browser | null = null

    const dpi = Math.max(96, Math.min(opts?.dpi ?? PDF_CONFIG.imageDPI, 600))
    const maxDim = Math.max(1024, Math.min(opts?.maxDimension ?? PDF_CONFIG.maxImageDimension, 12000))
    const format = opts?.format ?? PDF_CONFIG.imageFormat
    const quality = Math.max(1, Math.min(opts?.quality ?? PDF_CONFIG.imageQuality, 100))

    try {
        // Determine the PDF page size in points (1 pt = 1/72 in)
        const pdfDoc = await PDFDocument.load(pdfBuffer)
        const firstPage = pdfDoc.getPage(0)
        const widthPt = firstPage.getWidth()
        const heightPt = firstPage.getHeight()

        // Convert to pixels at target DPI, clamp to avoid extreme sizes
        let widthPx = Math.round((widthPt / 72) * dpi)
        let heightPx = Math.round((heightPt / 72) * dpi)

        const scale = Math.min(maxDim / widthPx, maxDim / heightPx, 1)
        widthPx = Math.max(1, Math.floor(widthPx * scale))
        heightPx = Math.max(1, Math.floor(heightPx * scale))

        console.log(
            `🖼️ Puppeteer render target: ${widthPx}x${heightPx}px @ ${dpi} DPI, format: ${format}, quality: ${quality} (page ${pageNum})`,
        )

        // Get browser from pool with retry logic
        browser = await withRetry(
            () => browserPool.getBrowser(),
            {
                maxRetries: PDF_CONFIG.puppeteerRetryAttempts,
                baseDelayMs: 1000,
                retryCondition: isRetryablePuppeteerError,
            }
        )

        const page = await browserPool.createPage(browser)

        // Exact viewport = PDF page pixel dimensions
        await page.setViewport({ width: widthPx, height: heightPx, deviceScaleFactor: 1 })

        // Build an HTML page that uses pdf.js to render the PDF into a canvas (works in headless)
        const base64 = pdfBuffer.toString('base64')
        const html = `<!doctype html><html><head><meta charset=\"utf-8\" />
                  <style>html,body{margin:0;padding:0;background:#ffffff;}#cvs{display:block;}</style>
                </head><body><canvas id=\"cvs\" width=\"${widthPx}\" height=\"${heightPx}\"></canvas></body></html>`

        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45000 })

        // Inject pdf.js from CDN for consistent classic build
        await page.addScriptTag({ url: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js' })

        // Define a plain JS renderer to avoid TS helpers in page context
        await page.addScriptTag({
            content: `
                                window.__renderSlide = async function(b64, pg, targetWidth){
                                    return new Promise(async function(resolve, reject){
                                        try {
                                            var pdfjsLib = window.pdfjsLib;
                                            function b64ToUint8Array(base64){
                                                var binary_string = atob(base64);
                                                var len = binary_string.length;
                                                var bytes = new Uint8Array(len);
                                                for (var i=0;i<len;i++){ bytes[i] = binary_string.charCodeAt(i); }
                                                return bytes;
                                            }
                                            var data = b64ToUint8Array(b64);
                                            var loadingTask = pdfjsLib.getDocument({ data: data, disableWorker: true });
                                            var pdf = await loadingTask.promise;
                                            var page = await pdf.getPage(pg);
                                            var canvas = document.getElementById('cvs');
                                            var ctx = canvas.getContext('2d');
                                            var viewport1 = page.getViewport({ scale: 1 });
                                            var scale = targetWidth / viewport1.width;
                                            var viewport = page.getViewport({ scale: scale });
                                            canvas.width = Math.round(viewport.width);
                                            canvas.height = Math.round(viewport.height);
                                            var renderContext = { canvasContext: ctx, viewport: viewport };
                                            var renderTask = page.render(renderContext);
                                            await renderTask.promise;
                                            window.__renderDone = true;
                                            resolve();
                                        } catch(e){ console.error('pdf.js render error', e); window.__renderDone = 'error'; reject(e); }
                                    });
                                }`
        })

        // Render with worker disabled (avoids needing worker file) with retry logic
        const rawPng = await withRetry(
            async () => {
                await page.evaluate((b64, pg, targetWidth) => (window as any).__renderSlide(b64, pg, targetWidth), base64, pageNum, widthPx)

                // Screenshot only the canvas area
                const rect = await page.$eval('#cvs', (el: any) => {
                    const r = el.getBoundingClientRect();
                    return { x: r.left, y: r.top, width: r.width, height: r.height };
                })
                return (await page.screenshot({ type: 'png', clip: { x: Math.max(0, Math.floor(rect.x)), y: Math.max(0, Math.floor(rect.y)), width: Math.max(1, Math.ceil(rect.width)), height: Math.max(1, Math.ceil(rect.height)) } })) as Buffer
            },
            {
                maxRetries: PDF_CONFIG.puppeteerRetryAttempts,
                baseDelayMs: 500,
                retryCondition: isRetryablePuppeteerError,
            }
        )

        // Process image based on format
        let processedImage: Buffer
        
        if (format === 'webp') {
            // Convert to WebP with quality setting and trim borders
            processedImage = await sharp(rawPng)
                .trim({ threshold: 8, background: 'white' })
                .webp({ quality, effort: 4 }) // effort 4 is good balance between speed and compression
                .toBuffer()
        } else {
            // Keep as PNG and trim borders
            processedImage = await sharp(rawPng)
                .trim({ threshold: 8, background: 'white' })
                .png({ compressionLevel: 6, adaptiveFiltering: true })
                .toBuffer()
        }

        // Safety: if processing failed or result is too small, fall back to raw PNG
        if (processedImage.length < 512) {
            console.warn(`⚠️ Processed ${format} too small (${processedImage.length} bytes), using raw PNG`)
            processedImage = rawPng
        }

        const compressionRatio = ((rawPng.length - processedImage.length) / rawPng.length * 100).toFixed(1)
        console.log(`✅ ${format.toUpperCase()} rendered (${processedImage.length} bytes) at ~${widthPx}x${heightPx} (${compressionRatio}% compression)`)
        
        return processedImage
    } catch (error) {
        console.error(`❌ Error converting PDF page ${pageNum} to image:`, error)
        return null
    } finally {
        if (browser) {
            try {
                // Release browser back to pool instead of closing
                await browserPool.releaseBrowser(browser)
            } catch (releaseError) {
                console.warn('Warning: Error releasing browser to pool:', releaseError)
            }
        }
    }
}

/**
 * Placeholder for a future non-Puppeteer fallback (intentionally returns null).
 */
export async function convertPDFPageToImageFallback(
    _pdfBuffer: Buffer,
    _pageNum: number = 1
): Promise<Buffer | null> {
    console.warn('⚠️ Fallback image conversion not implemented')
    return null
}

// --- Internals ---
async function launchChromium(viewport: { width: number; height: number }): Promise<Browser> {
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--hide-scrollbars',
        `--window-size=${viewport.width},${viewport.height}`,
    ]

    const headlessEnv = process.env.CHROME_HEADLESS
    const headless = headlessEnv === '0' ? false : true

    // Try puppeteer first (bundled Chromium in dev), then puppeteer-core
    let puppeteerModule: any = null
    let useCore = false
    try {
        puppeteerModule = await import('puppeteer')
        console.log('🧭 Using puppeteer (bundled Chromium)')
    } catch {
        puppeteerModule = await import('puppeteer-core')
        useCore = true
        console.log('🧭 Using puppeteer-core (no bundled Chromium)')
    }

    let executablePath: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH

    // If using puppeteer, try its bundled executablePath
    if (!executablePath && !useCore && typeof puppeteerModule.executablePath === 'function') {
        try {
            executablePath = puppeteerModule.executablePath()
        } catch { }
    }

    // Try @sparticuz/chromium for serverless
    if (!executablePath) {
        try {
            const chromium = await import('@sparticuz/chromium')
            executablePath = await chromium.executablePath()
            // Use chromium recommended args/headless if provided
            if (chromium.args) {
                args.push(...chromium.args)
            }
            console.log('🧭 Using @sparticuz/chromium executable')
        } catch {
            // ignore
        }
    }

    // Last-resort common paths (macOS/Linux)
    if (!executablePath) {
        const candidates = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
        ]
        executablePath = candidates.find((p) => existsSync(p))
    }

    // Launch
    console.log('🧭 Launching Chromium with:', {
        headless,
        executablePath,
        argsCount: args.length,
        hasViewport: true,
    })
    return puppeteerModule.launch({
        headless,
        executablePath,
        args,
        defaultViewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: 1 },
    })
}
