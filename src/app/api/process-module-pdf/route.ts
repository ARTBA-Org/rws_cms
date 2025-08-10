import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const { moduleId } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod = await payload.findByID({ collection: 'modules', id: String(moduleId) })
    const pdfUpload = mod.pdfUpload
    const pdfId = typeof pdfUpload === 'object' ? (pdfUpload as any).id : pdfUpload
    if (!pdfId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // PDF collection has been removed
    return NextResponse.json({ error: 'PDF processing is disabled' }, { status: 410 })

    // Unreachable due to early return; keep function structure
  } catch (e: any) {
    console.error('process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
