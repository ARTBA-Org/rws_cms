export async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const cloudRunUrl = process.env.PDF_PROCESSOR_CLOUD_RUN_URL

  if (!cloudRunUrl) {
    throw new Error('PDF_PROCESSOR_CLOUD_RUN_URL environment variable is required')
  }

  try {
    const formData = new FormData()
    formData.append('pdf', new Blob([pdfBuffer]), 'document.pdf')

    const response = await fetch(`${cloudRunUrl}/convert-pdf`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${process.env.CLOUD_RUN_SERVICE_TOKEN || ''}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Cloud Run PDF service error: ${response.statusText}`)
    }

    const result = await response.json()

    // Assuming the service returns base64 encoded images
    const images: Buffer[] = result.images.map((base64Image: string) =>
      Buffer.from(base64Image, 'base64'),
    )

    return images
  } catch (error) {
    console.error('Cloud Run PDF service error:', error)
    throw error
  }
}
