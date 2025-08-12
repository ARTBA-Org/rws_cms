import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const moduleId = body.moduleId
    const startPage: number = Math.max(1, Number(body.startPage || 1))
    const batchSize: number = Math.max(1, Math.min(2, Number(body.batchSize || 1)))

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

    // Use the correct API base URL for your deployed Lambda
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

    console.log(`[process-module-pdf-fixed] Fetching PDF from: ${finalUrl}`)

    const bufRes = await fetch(finalUrl, { cache: 'no-store' })
    if (!bufRes.ok) {
      console.error(
        `[process-module-pdf-fixed] Failed to fetch PDF: ${bufRes.status} ${bufRes.statusText}`,
      )
      return NextResponse.json(
        { error: `Failed to fetch media: ${bufRes.status} ${bufRes.statusText}` },
        { status: 502 },
      )
    }

    const pdfBuffer = Buffer.from(await bufRes.arrayBuffer())
    console.log(`[process-module-pdf-fixed] PDF fetched successfully: ${pdfBuffer.length} bytes`)

    // Create FormData for the Lambda function
    const formData = new FormData()
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    formData.append('file', blob, mediaDoc.filename || 'document.pdf')

    // Call the correct endpoint from your deployed Lambda
    console.log(`[process-module-pdf-fixed] Calling Lambda at: ${apiBase}/process-pdf-with-ai`)

    const aiRes = await fetch(`${apiBase}/process-pdf-with-ai`, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    })

    if (!aiRes.ok) {
      const errorText = await aiRes.text()
      console.error(`[process-module-pdf-fixed] Lambda call failed: ${aiRes.status} - ${errorText}`)
      return NextResponse.json(
        { error: `AI processing failed: ${aiRes.status} ${aiRes.statusText} - ${errorText}` },
        { status: 502 },
      )
    }

    const aiResult = await aiRes.json()
    console.log(`[process-module-pdf-fixed] Lambda response:`, aiResult)

    if (!aiResult.success || !aiResult.results) {
      return NextResponse.json(
        { error: 'Invalid response from AI processing service' },
        { status: 502 },
      )
    }

    const results = aiResult.results
    console.log(`[process-module-pdf-fixed] Processing ${results.length} pages`)

    // Normalize AI analysis into structured fields
    const stripCodeFences = (text: string) =>
      text
        .replace(/```[a-zA-Z]*\n?/g, '')
        .replace(/```/g, '')
        .trim()

    const tryParseJson = (text: string): any | null => {
      try {
        return JSON.parse(text)
      } catch {
        const fenceMatch = text.match(/```json[\s\S]*?```/i) || text.match(/```[\s\S]*?```/)
        const candidate = fenceMatch ? fenceMatch[0].replace(/```json|```/gi, '') : text
        const first = candidate.indexOf('{')
        const last = candidate.lastIndexOf('}')
        if (first !== -1 && last !== -1 && last > first) {
          let slice = candidate.substring(first, last + 1)
          slice = slice.replace(/,\s*([}\]])/g, '$1')
          slice = slice.replace(/[""]/g, '"').replace(/['']/g, "'")
          try {
            return JSON.parse(slice)
          } catch {}
        }
        return null
      }
    }

    const normalize = (raw: any) => {
      if (!raw) {
        return {
          title: '',
          summary: '',
          key_points: [],
          data_points: [],
          topic: '',
          action_items: [],
        }
      }

      let obj: any = raw
      if (typeof raw === 'string') {
        obj = tryParseJson(raw)
        if (!obj) {
          const jsonMatch =
            raw.match(/```json[\s\S]*?```/i) ||
            raw.match(/```[\s\S]*?```/) ||
            raw.match(/\{[\s\S]*\}/)

          if (jsonMatch) {
            const extracted = jsonMatch[0].replace(/```json|```/gi, '').trim()
            obj = tryParseJson(extracted)
          }
        }
        if (!obj) {
          obj = { summary: raw }
        }
      }

      if (obj && typeof obj.summary === 'string') {
        const inner = tryParseJson(stripCodeFences(obj.summary))
        if (inner && typeof inner === 'object') {
          const innerKeyPoints = Array.isArray(inner.key_points)
            ? inner.key_points
            : Array.isArray(inner.main_points)
              ? inner.main_points
              : []
          const innerDataPoints = Array.isArray(inner.data_points)
            ? inner.data_points
            : Array.isArray(inner.facts)
              ? inner.facts
              : []
          obj = {
            ...obj,
            title: inner.title || inner.name || obj.title || '',
            summary:
              inner.summary ||
              inner.description ||
              (innerKeyPoints.length ? `Key points:\n- ${innerKeyPoints.join('\n- ')}` : ''),
            key_points:
              Array.isArray(obj.key_points) && obj.key_points.length
                ? obj.key_points
                : innerKeyPoints,
            data_points:
              Array.isArray(obj.data_points) && obj.data_points.length
                ? obj.data_points
                : innerDataPoints,
            topic: obj.topic || inner.topic || inner.created_for || '',
            action_items:
              Array.isArray(obj.action_items) && obj.action_items.length
                ? obj.action_items
                : Array.isArray(inner.action_items)
                  ? inner.action_items
                  : Array.isArray(inner.actions)
                    ? inner.actions
                    : [],
          }
        }
      }

      if (typeof obj === 'object' && obj !== null) {
        return {
          title: obj.title || '',
          summary: obj.summary || obj.description || '',
          key_points: Array.isArray(obj.key_points) ? obj.key_points : [],
          data_points: Array.isArray(obj.data_points) ? obj.data_points : [],
          topic: obj.topic || '',
          action_items: Array.isArray(obj.action_items) ? obj.action_items : [],
        }
      }

      return {
        title: '',
        summary: String(raw),
        key_points: [],
        data_points: [],
        topic: '',
        action_items: [],
      }
    }

    // Create slides and attach to module
    const slideIds: Array<number | string> = []
    let slidesCreated = 0

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

    // Process each page result
    for (const result of results) {
      try {
        const pageNum = result.page
        const analysis = normalize(result.analysis)

        console.log(`[process-module-pdf-fixed] Processing page ${pageNum}:`, analysis)

        // Create a placeholder media entry (since we don't have the actual image)
        const mediaImage = await withRetry(
          () =>
            payload.create({
              collection: 'media',
              data: {
                alt: `Page ${pageNum} from ${mediaDoc.filename || 'document.pdf'}`,
                filename: `${(mediaDoc.filename || 'document').replace(/\.pdf$/i, '')}_page_${pageNum}.png`,
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
                  `${(mediaDoc.filename || 'document').replace(/\.pdf$/i, '')} - Page ${pageNum}`,
                description:
                  analysis.summary ||
                  (analysis.key_points?.length
                    ? `Key points:\n- ${analysis.key_points.join('\n- ')}`
                    : `Page ${pageNum} from ${mediaDoc.filename || 'document.pdf'}`),
                type: (() => {
                  const text =
                    `${analysis.title} ${analysis.summary} ${analysis.topic}`.toLowerCase()
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
        await sleep(100)
      } catch (err) {
        console.error(
          `[process-module-pdf-fixed] Failed to create slide for page ${result.page}:`,
          err,
        )
      }
    }

    // Update module with new slides
    const currentModule = await withRetry(
      () =>
        payload.findByID({
          collection: 'modules',
          id: String(moduleId),
          overrideAccess: true,
        }),
      'modules.findByID',
    )

    const previousSlides = (currentModule as any).slides || []
    const nextSlides =
      startPage <= 1 ? (slideIds as any) : ([...previousSlides, ...slideIds] as any)

    await payload.update({
      collection: 'modules',
      id: String(moduleId),
      data: { slides: nextSlides },
      overrideAccess: true,
      depth: 0,
    })

    console.log(`[process-module-pdf-fixed] Successfully created ${slidesCreated} slides`)

    return NextResponse.json(
      {
        success: true,
        slidesCreated,
        page_count: aiResult.page_count || results.length,
        replacedSlides: startPage <= 1 ? previousSlides.length : 0,
        totalPages: results.length,
        processed: results.map((r: any) => r.page),
        mode: 'fixed',
      },
      { status: 200 },
    )
  } catch (e: any) {
    console.error('[process-module-pdf-fixed] error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
