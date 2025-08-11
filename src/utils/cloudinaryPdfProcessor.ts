import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  try {
    // Upload PDF to Cloudinary
    const uploadResult = (await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'raw',
            format: 'pdf',
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          },
        )
        .end(pdfBuffer)
    })) as any

    // Get PDF info to determine page count
    const pdfInfo = await cloudinary.api.resource(uploadResult.public_id, {
      resource_type: 'raw',
      pages: true,
    })

    const images: Buffer[] = []
    const pageCount = pdfInfo.pages || 1

    // Convert each page to image
    for (let page = 1; page <= pageCount; page++) {
      const imageUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: 'raw',
        format: 'jpg',
        page: page,
        quality: 'auto',
        fetch_format: 'auto',
      })

      // Fetch the image
      const response = await fetch(imageUrl)
      const imageBuffer = Buffer.from(await response.arrayBuffer())
      images.push(imageBuffer)
    }

    // Clean up uploaded PDF
    await cloudinary.uploader.destroy(uploadResult.public_id, {
      resource_type: 'raw',
    })

    return images
  } catch (error) {
    console.error('Cloudinary PDF conversion error:', error)
    throw error
  }
}
