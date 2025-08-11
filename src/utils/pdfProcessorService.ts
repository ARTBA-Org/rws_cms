export interface PdfAnalysisResult {
  page: number
  analysis: {
    title: string
    key_points: string[]
    data_points: string[]
    topic: string
    action_items: string[]
    summary: string
  }
}

export interface PdfProcessingResponse {
  success: boolean
  page_count: number
  filename: string
  results: PdfAnalysisResult[]
}

export async function processPdfWithAI(pdfBuffer: Buffer): Promise<PdfProcessingResponse> {
  // Prefer Lambda API if configured, else fallback to Cloud Run
  const apiBase = process.env.PDF_PROCESSOR_API_URL
  if (apiBase) {
    // Lambda flow using S3 presigned upload + process-from-s3
    console.log('🔧 Using Lambda PDF processor via S3 presigned upload')
    // 1) Presign
    const presignRes = await fetch(`${apiBase}/presign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { filename: 'document.pdf' } }),
      cache: 'no-store',
    })
    if (!presignRes.ok) {
      const txt = await presignRes.text()
      throw new Error(`Presign error: ${presignRes.status} ${presignRes.statusText} - ${txt}`)
    }
    const { upload_url, key } = await presignRes.json()
    if (!upload_url || !key) throw new Error('Invalid presign response')

    // 2) Upload to S3
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBuffer,
    })
    if (!putRes.ok) {
      const txt = await putRes.text()
      throw new Error(`S3 upload failed: ${putRes.status} ${putRes.statusText} - ${txt}`)
    }

    // 3) Process from S3
    const procRes = await fetch(`${apiBase}/process-from-s3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { key } }),
      cache: 'no-store',
    })
    if (!procRes.ok) {
      const txt = await procRes.text()
      throw new Error(`Process-from-s3 error: ${procRes.status} ${procRes.statusText} - ${txt}`)
    }
    const result: PdfProcessingResponse = await procRes.json()
    if (!result.success) throw new Error('PDF processing failed on Lambda service')
    console.log(`✅ Successfully processed ${result.page_count} pages with AI (Lambda)`)
    return result
  }

  // Cloud Run fallback
  const cloudRunUrl = process.env.PDF_PROCESSOR_CLOUD_RUN_URL
  if (!cloudRunUrl) {
    throw new Error('Set PDF_PROCESSOR_API_URL (Lambda) or PDF_PROCESSOR_CLOUD_RUN_URL (fallback)')
  }
  try {
    console.log('🔧 Using Cloud Run PDF processor for AI analysis')
    const formData = new FormData()
    formData.append('file', new Blob([pdfBuffer]), 'document.pdf')
    const response = await fetch(`${cloudRunUrl}/process-pdf-with-ai`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Cloud Run PDF service error: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }
    const result: PdfProcessingResponse = await response.json()
    if (!result.success) throw new Error('PDF processing failed on Cloud Run service')
    console.log(`✅ Successfully processed ${result.page_count} pages with AI`)
    return result
  } catch (error) {
    console.error('Cloud Run PDF service error:', error)
    throw error
  }
}

export async function convertPdfToImages(pdfBuffer: Buffer): Promise<string[]> {
  const cloudRunUrl = process.env.PDF_PROCESSOR_CLOUD_RUN_URL

  if (!cloudRunUrl) {
    throw new Error('PDF_PROCESSOR_CLOUD_RUN_URL environment variable is required')
  }

  try {
    console.log('🔧 Using Cloud Run PDF processor for image conversion')

    const formData = new FormData()
    formData.append('file', new Blob([pdfBuffer]), 'document.pdf')

    const response = await fetch(`${cloudRunUrl}/convert-pdf`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Cloud Run PDF service error: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error('PDF conversion failed on Cloud Run service')
    }

    // Return base64 images
    return result.images.map((img: any) => img.image)
  } catch (error) {
    console.error('Cloud Run PDF service error:', error)
    throw error
  }
}
