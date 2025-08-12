import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

interface ProcessingTask {
  task_id: string
  status: 'processing' | 'completed' | 'error'
  filename: string
  total_pages: number
  processed_pages: number
  progress_percent: number
  results?: Array<{
    page: number
    analysis: {
      title: string
      summary: string
      key_points: string[]
      data_points: string[]
      topic: string
      action_items: string[]
    }
  }>
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { moduleId, mode = 'auto' } = body // mode: 'sync', 'async', 'auto'

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod: any = await payload.findByID({
      collection: 'modules',
      id: String(moduleId),
      overrideAccess: true,
      depth: 0,
    })

    const pdfUpload = mod.pdfUpload
    const mediaId = typeof pdfUpload === 'object' ? (pdfUpload as any).id : pdfUpload

    if (!mediaId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // Get the media document
    const mediaDoc: any = await payload.findByID({
      collection: 'media',
      id: String(mediaId),
      overrideAccess: true,
      depth: 0,
    })

    if (!mediaDoc?.url) {
      return NextResponse.json({ error: 'Media file has no accessible URL' }, { status: 400 })
    }

    // Get improved API base URL
    const apiBase =
      process.env.PDF_PROCESSOR_API_URL ||
      process.env.NEXT_PUBLIC_PDF_PROCESSOR_API_URL ||
      process.env.PAYLOAD_PUBLIC_PDF_PROCESSOR_API_URL ||
      'https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod'

    if (!apiBase) {
      return NextResponse.json(
        { error: 'PDF_PROCESSOR_API_URL is not configured' },
        { status: 500 },
      )
    }

    // Fetch the PDF file
    const fileId = typeof mediaDoc?.id === 'string' ? mediaDoc.id : String(mediaDoc?.id)
    const file = await payload.findByID({
      collection: 'media',
      id: fileId,
      overrideAccess: true,
    })

    if (!file || !file.filename) {
      return NextResponse.json({ error: 'Media file not found' }, { status: 404 })
    }

    const filePath = file.url as string
    const serverOrigin = process.env.PAYLOAD_PUBLIC_SERVER_URL || ''
    const finalUrl = filePath.startsWith('http') ? filePath : `${serverOrigin}${filePath}`

    const bufRes = await fetch(finalUrl, { cache: 'no-store' })
    if (!bufRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch media: ${bufRes.status}` },
        { status: 502 },
      )
    }

    const pdfBuffer = Buffer.from(await bufRes.arrayBuffer())
    const fileSizeMB = pdfBuffer.length / (1024 * 1024)

    // Determine processing mode
    let processingMode = mode
    if (mode === 'auto') {
      // Auto-select based on file size and estimated page count
      processingMode = fileSizeMB > 10 ? 'async' : 'sync'
    }

    console.log(
      `[process-module-pdf-improved] Processing ${mediaDoc.filename} (${fileSizeMB.toFixed(1)}MB) in ${processingMode} mode`,
    )

    // Create FormData for file upload
    const formData = new FormData()
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    formData.append('file', blob, mediaDoc.filename || 'document.pdf')

    if (processingMode === 'sync') {
      // Synchronous processing for small files
      const response = await fetch(`${apiBase}/process-pdf-sync`, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: `Sync processing failed: ${response.status} - ${errorText}` },
          { status: 502 },
        )
      }

      const result = await response.json()

      // Process results and create slides immediately
      const slidesCreated = await createSlidesFromResults(
        payload,
        moduleId,
        mediaDoc,
        result.results,
      )

      return NextResponse.json({
        success: true,
        mode: 'sync',
        slidesCreated,
        page_count: result.page_count,
        processing_time: result.processing_time,
        dpi_used: result.dpi_used,
      })
    } else {
      // Asynchronous processing for large files
      const response = await fetch(`${apiBase}/process-pdf-async`, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: `Async processing failed: ${response.status} - ${errorText}` },
          { status: 502 },
        )
      }

      const result = await response.json()

      // Store task info for polling
      // In production, store this in Redis or database
      console.log(
        `[process-module-pdf-improved] Started async task ${result.task_id} for module ${moduleId}`,
      )

      return NextResponse.json({
        success: true,
        mode: 'async',
        task_id: result.task_id,
        total_pages: result.total_pages,
        estimated_time_seconds: result.estimated_time_seconds,
        polling_url: `/api/pdf-processing-status-improved/${result.task_id}?moduleId=${moduleId}`,
      })
    }
  } catch (e: any) {
    console.error('process-module-pdf-improved error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

async function createSlidesFromResults(
  payload: any,
  moduleId: string,
  mediaDoc: any,
  results: any[],
): Promise<number> {
  let slidesCreated = 0

  // Helper functions
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))
  const withRetry = async <T>(op: () => Promise<T>, label: string, max = 3): Promise<T> => {
    let lastErr: any
    for (let i = 1; i <= max; i++) {
      try {
        return await op()
      } catch (e) {
        lastErr = e
        await sleep(250 * i)
      }
    }
    throw new Error(`${label} failed after ${max} attempts: ${lastErr?.message || lastErr}`)
  }

  // Clear existing slides for this PDF
  const currentModule = await withRetry(
    () =>
      payload.findByID({
        collection: 'modules',
        id: String(moduleId),
        overrideAccess: true,
      }),
    'modules.findByID',
  )

  const slideIds: Array<number | string> = []

  for (const result of results) {
    try {
      const analysis = result.analysis

      // Create a simple image placeholder (in production, you'd store the actual image)
      const mediaImage = await withRetry(
        () =>
          payload.create({
            collection: 'media',
            data: {
              alt: `Page ${result.page} from ${mediaDoc.filename || 'document.pdf'}`,
              filename: `${(mediaDoc.filename || 'document').replace(/\.pdf$/i, '')}_page_${result.page}.png`,
            },
            overrideAccess: true,
            depth: 0,
          }),
        'media.create',
      )

      const slide = await withRetry(
        () =>
          payload.create({
            collection: 'slides',
            data: {
              title:
                analysis.title ||
                `${(mediaDoc.filename || 'document').replace(/\.pdf$/i, '')} - Page ${result.page}`,
              description:
                analysis.summary ||
                (analysis.key_points?.length
                  ? `Key points:\n- ${analysis.key_points.join('\n- ')}`
                  : `Page ${result.page} from ${mediaDoc.filename || 'document.pdf'}`),
              type: (() => {
                const text = `${analysis.title} ${analysis.summary} ${analysis.topic}`.toLowerCase()
                if (/\bquiz\b|\bquestion\b|true\/?false|multiple choice/.test(text)) return 'quiz'
                if (/\breference\b|\breferences\b|\bcitation\b/.test(text)) return 'reference'
                if (/\bvideo\b|\bwatch\b/.test(text)) return 'video'
                if (/\bresource(s)?\b|\breading\b/.test(text)) return 'resources'
                return 'regular'
              })(),
              image: mediaImage.id,
              urls: [],
            },
            overrideAccess: true,
            depth: 0,
          }),
        'slides.create',
      )

      slideIds.push(slide.id)
      slidesCreated++

      // Small delay to avoid overwhelming the database
      await sleep(100)
    } catch (err) {
      console.error(`Failed to create slide for page ${result.page}:`, err)
      // Continue with other pages
    }
  }

  // Update module with new slides
  await payload.update({
    collection: 'modules',
    id: String(moduleId),
    data: { slides: slideIds as any },
    overrideAccess: true,
    depth: 0,
  })

  return slidesCreated
}

// GET endpoint for checking async processing status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const taskId = url.searchParams.get('taskId')
    const moduleId = url.searchParams.get('moduleId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const apiBase =
      process.env.PDF_PROCESSOR_API_URL ||
      'https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod'

    const response = await fetch(`${apiBase}/status/${taskId}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Status check failed: ${response.status}` },
        { status: 502 },
      )
    }

    const status: ProcessingTask = await response.json()

    // If completed and moduleId provided, create slides
    if (status.status === 'completed' && status.results && moduleId) {
      const payload = await getPayload({ config })

      const mediaDoc: any = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
        overrideAccess: true,
        depth: 1,
      })

      if (mediaDoc?.pdfUpload) {
        const slidesCreated = await createSlidesFromResults(
          payload,
          moduleId,
          mediaDoc.pdfUpload,
          status.results,
        )

        // Clean up the task
        await fetch(`${apiBase}/task/${taskId}`, { method: 'DELETE' })

        return NextResponse.json({
          ...status,
          slidesCreated,
          cleanup: true,
        })
      }
    }

    return NextResponse.json(status)
  } catch (e: any) {
    console.error('Status check error:', e)
    return NextResponse.json({ error: e?.message || 'Status check failed' }, { status: 500 })
  }
}
