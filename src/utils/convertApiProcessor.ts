export async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const apiSecret = process.env.CONVERTAPI_SECRET

  if (!apiSecret) {
    throw new Error('CONVERTAPI_SECRET environment variable is required')
  }

  try {
    // Convert PDF to JPG using ConvertAPI
    const formData = new FormData()
    formData.append('File', new Blob([pdfBuffer]), 'document.pdf')
    formData.append('StoreFile', 'true')

    const response = await fetch(
      `https://v2.convertapi.com/convert/pdf/to/jpg?Secret=${apiSecret}`,
      {
        method: 'POST',
        body: formData,
      },
    )

    if (!response.ok) {
      throw new Error(`ConvertAPI error: ${response.statusText}`)
    }

    const result = await response.json()
    const images: Buffer[] = []

    // Download each converted image
    for (const file of result.Files) {
      const imageResponse = await fetch(file.Url)
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
      images.push(imageBuffer)
    }

    return images
  } catch (error) {
    console.error('ConvertAPI PDF conversion error:', error)
    throw error
  }
}
