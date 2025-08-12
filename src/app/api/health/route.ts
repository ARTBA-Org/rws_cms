import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    features: {
      pdfProcessing: process.env.NODE_ENV !== 'production' || !!process.env.ENABLE_PDF_PROCESSING,
      database: !!process.env.DATABASE_URI,
      storage: !!process.env.AWS_ACCESS_KEY,
    },
  })
}
