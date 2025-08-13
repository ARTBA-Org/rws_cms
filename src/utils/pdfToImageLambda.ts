/**
 * PDF to Image conversion for AWS Lambda using Puppeteer
 * Requires @sparticuz/chromium and puppeteer-core packages
 */

import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function convertPDFPageToImage(
  pdfBuffer: Buffer,
  pageNumber: number = 1,
  originalPageNum?: number,
): Promise<Buffer | null> {
  let browser = null

  try {
    const displayPage = originalPageNum || pageNumber
    console.log(`🖼️ Converting PDF page ${displayPage} to image using Puppeteer...`)

    // Launch headless Chrome in Lambda
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()

    // Convert PDF buffer to base64 data URL
    const pdfBase64 = pdfBuffer.toString('base64')
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`

    // HTML template to render PDF using PDF.js
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          canvas { display: block; }
        </style>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          async function renderPDF() {
            const pdfData = atob('${pdfBase64}');
            const pdfArray = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
              pdfArray[i] = pdfData.charCodeAt(i);
            }
            
            const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
            const page = await pdf.getPage(${pageNumber});
            
            const scale = 2.0; // Higher resolution
            const viewport = page.getViewport({ scale });
            
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
            
            // Signal that rendering is complete
            window.renderComplete = true;
          }
          
          renderPDF().catch(console.error);
        </script>
      </body>
      </html>
    `

    // Set the HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' })

    // Wait for PDF rendering to complete
    await page.waitForFunction(() => (window as any).renderComplete === true, {
      timeout: 30000,
    })

    // Take screenshot of the rendered PDF page
    const screenshot = (await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'binary',
    })) as Buffer

    console.log(
      `✅ Successfully converted PDF page ${pageNumber} to image (${screenshot.length} bytes)`,
    )
    return screenshot
  } catch (error) {
    console.error('❌ Error converting PDF to image:', error)
    return null
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
