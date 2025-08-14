import puppeteer from 'puppeteer'

/**
 * Convert PDF page to image using Puppeteer (Local development version)
 * This version uses regular Puppeteer without Lambda-specific optimizations
 */
export async function convertPDFPageToImageLocal(
  pdfBuffer: Buffer,
  pageNum: number = 1,
  originalPageNum?: number,
): Promise<Buffer | null> {
  const displayPage = originalPageNum || pageNum
  console.log(`🖼️ Converting PDF page ${displayPage} to image using Puppeteer (Local)...`)

  let browser = null

  try {
    // Launch regular Puppeteer for local development
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
      ],
    })

    const page = await browser.newPage()

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    })

    // Create HTML with embedded PDF using pdf.js
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 20px; background: white; }
          canvas { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          const pdfData = atob('${pdfBuffer.toString('base64')}');
          const pdfArray = new Uint8Array(pdfData.length);
          for (let i = 0; i < pdfData.length; i++) {
            pdfArray[i] = pdfData.charCodeAt(i);
          }
          
          pdfjsLib.getDocument({data: pdfArray}).promise.then(pdf => {
            pdf.getPage(${pageNum}).then(page => {
              const scale = 2;
              const viewport = page.getViewport({ scale });
              const canvas = document.getElementById('pdf-canvas');
              const context = canvas.getContext('2d');
              
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              page.render({
                canvasContext: context,
                viewport: viewport
              }).promise.then(() => {
                window.renderComplete = true;
              });
            });
          });
        </script>
      </body>
      </html>
    `

    await page.setContent(html, { waitUntil: 'networkidle0' })

    // Wait for PDF to render
    await page.waitForFunction(() => (window as any).renderComplete === true, {
      timeout: 10000,
    })

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      encoding: 'binary',
    })

    await browser.close()

    const buffer = Buffer.from(screenshot as Buffer)
    console.log(`✅ Successfully converted PDF page ${pageNum} to image (${buffer.length} bytes)`)

    return buffer
  } catch (error) {
    console.error('❌ Error converting PDF to image:', error)
    if (browser) {
      await browser.close()
    }
    return null
  }
}
