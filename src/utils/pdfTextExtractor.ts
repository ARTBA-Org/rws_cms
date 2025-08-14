/**
 * PDF text extraction utility for Lambda environment
 * Handles pdf-parse initialization issues in serverless environments
 */

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<{
  text: string
  numpages: number
  info: any
  metadata: any
} | null> {
  try {
    // Dynamic import to avoid initialization issues
    const pdfParse = await import('pdf-parse/lib/pdf-parse.js')
    
    // Use the default export or the function directly
    const parse = pdfParse.default || pdfParse
    
    // Parse the PDF with minimal options to avoid test file loading
    const data = await parse(pdfBuffer, {
      // Don't specify version to avoid test file loading
      pagerender: null, // Disable page rendering
      max: 0, // Process all pages
    })
    
    return {
      text: data.text || '',
      numpages: data.numpages || 0,
      info: data.info || {},
      metadata: data.metadata || {},
    }
  } catch (error) {
    console.warn('PDF text extraction failed, falling back to basic parsing:', error)
    
    // Fallback: Try to at least get page count from pdf-lib
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()
      
      return {
        text: '',
        numpages: pageCount,
        info: {},
        metadata: {},
      }
    } catch (fallbackError) {
      console.error('Fallback PDF parsing also failed:', fallbackError)
      return null
    }
  }
}