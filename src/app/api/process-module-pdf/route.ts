import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const moduleId = body.moduleId
    const startPage: number = Math.max(1, Number(body.startPage || 1))
    // Cap batch size conservatively to keep each request < 30s on Amplify
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

    // Strictly use DeployIt Lambda API
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

    // Fetch the PDF bytes from media storage
    // Read the PDF file directly from Payload local API (no HTTP/cookies)
    const fileId = typeof mediaDoc?.id === 'string' ? mediaDoc.id : String(mediaDoc?.id)
    const file = await payload.findByID({ collection: 'media', id: fileId, overrideAccess: true })
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

    // 1) Presign upload
    const presign = await fetch(`${apiBase}/presign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { filename: mediaDoc.filename || 'document.pdf' } }),
      cache: 'no-store',
    })
    if (!presign.ok) {
      const txt = await presign.text()
      return NextResponse.json(
        { error: `Presign failed: ${presign.status} ${presign.statusText} - ${txt}` },
        { status: 502 },
      )
    }
    const { upload_url, key } = await presign.json()
    if (!upload_url || !key) {
      return NextResponse.json({ error: 'Invalid presign response' }, { status: 502 })
    }

    // 2) Upload to S3
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBuffer,
    })
    if (!putRes.ok) {
      const txt = await putRes.text()
      return NextResponse.json(
        { error: `S3 upload failed: ${putRes.status} ${putRes.statusText} - ${txt}` },
        { status: 502 },
      )
    }

    // 3) Convert to images (returns presigned image URLs)
    const convRes = await fetch(`${apiBase}/convert-from-s3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { key } }),
      cache: 'no-store',
    })
    if (!convRes.ok) {
      const txt = await convRes.text()
      return NextResponse.json(
        { error: `Conversion failed: ${convRes.status} ${convRes.statusText} - ${txt}` },
        { status: 502 },
      )
    }
    const convert = await convRes.json()
    const images: Array<{ page: number; key: string; url: string }> = convert.images || []
    const totalPages = images.length
    // Batched mode: only process requested slice to stay under Amplify 28s limit
    const startIdx = Math.max(0, startPage - 1)
    const endIdx = Math.min(totalPages, startIdx + batchSize)
    const imagesToProcess = images.slice(startIdx, endIdx)

    // 4) AI analysis (batched)
    const aiRes = await fetch(`${apiBase}/process-from-s3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { key, start_page: startPage, max_pages: batchSize, debug: true } }),
      cache: 'no-store',
    })
    if (!aiRes.ok) {
      const txt = await aiRes.text()
      return NextResponse.json(
        { error: `AI processing failed: ${aiRes.status} ${aiRes.statusText} - ${txt}` },
        { status: 502 },
      )
    }
    const ai = await aiRes.json()
    const results: Array<{ page: number; analysis: any }> = ai.results || []

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
        // If fenced, prefer fenced block
        const fenceMatch = text.match(/```json[\s\S]*?```/i) || text.match(/```[\s\S]*?```/)
        const candidate = fenceMatch ? fenceMatch[0].replace(/```json|```/gi, '') : text
        const first = candidate.indexOf('{')
        const last = candidate.lastIndexOf('}')
        if (first !== -1 && last !== -1 && last > first) {
          let slice = candidate.substring(first, last + 1)
          // Heuristics: remove trailing commas before } or ]
          slice = slice.replace(/,\s*([}\]])/g, '$1')
          // Heuristics: normalize smart quotes
          slice = slice.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
          try {
            return JSON.parse(slice)
          } catch {}
        }
        return null
      }
    }

    const normalize = (raw: any) => {
      if (!raw)
        return {
          title: '',
          summary: '',
          key_points: [],
          data_points: [],
          topic: '',
          action_items: [],
        }
      let obj: any = raw
      if (typeof raw === 'string') {
        // First try to parse the entire string as JSON
        obj = tryParseJson(raw)

        // If that fails, check if there's a JSON block within the text
        if (!obj) {
          // Look for JSON anywhere in the string (with or without fences)
          const jsonMatch =
            raw.match(/```json[\s\S]*?```/i) ||
            raw.match(/```[\s\S]*?```/) ||
            raw.match(/\{[\s\S]*\}/)

          if (jsonMatch) {
            const extracted = jsonMatch[0].replace(/```json|```/gi, '').trim()
            obj = tryParseJson(extracted)
          }
        }

        // If still no JSON found, treat the whole string as summary
        if (!obj) {
          obj = { summary: raw }
        }
      }
      // If model returned structured fields but summary itself contains fenced JSON, extract
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
            // Prefer values parsed from inner JSON over the outer wrapper text
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

    const pageToAnalysis = new Map<number, ReturnType<typeof normalize>>()
    for (const r of results) pageToAnalysis.set(r.page, normalize(r.analysis))

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
          // brief backoff to survive transient DB disconnects in Amplify
          await sleep(250 * i)
        }
      }
      throw new Error(`${label} failed after ${max} attempts: ${lastErr?.message || lastErr}`)
    }
    for (const img of imagesToProcess) {
      try {
        const imgRes = await fetch(img.url, { cache: 'no-store' })
        if (!imgRes.ok) continue
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

        const mediaImage = await withRetry(
          () =>
            payload.create({
              collection: 'media',
              data: { alt: `Page ${img.page} from ${mediaDoc.filename || 'document.pdf'}` },
              file: {
                data: imgBuffer,
                mimetype: 'image/png',
                name: `${(mediaDoc.filename || 'document').replace(/\.pdf$/i, '')}_page_${img.page}.png`,
                size: imgBuffer.length,
              },
              overrideAccess: true,
              depth: 0,
            }),
          'media.create',
        )

        const analysis = pageToAnalysis.get(img.page) || normalize(null)
        const slide = await withRetry(
          () =>
            payload.create({
              collection: 'slides',
              data: {
                title:
                  analysis.title ||
                  `${(mediaDoc.filename || 'document').replace(/\.pdf$/i, '')} - Page ${img.page}`,
                description:
                  analysis.summary ||
                  (analysis.key_points?.length
                    ? `Key points:\n- ${analysis.key_points.join('\n- ')}`
                    : `Page ${img.page} from ${mediaDoc.filename || 'document.pdf'}`),
                type: 'regular',
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
        // small delay to avoid hammering DB pool in Amplify
        await sleep(100)
      } catch (err) {
        // Continue other pages
      }
    }

    // Replace on first batch; append for subsequent batches
    const currentModule = await withRetry(
      () => payload.findByID({ collection: 'modules', id: String(moduleId), overrideAccess: true }),
      'modules.findByID',
    )
    const previousSlides = (currentModule as any).slides || []
    const nextSlides = startPage <= 1 ? (slideIds as any) : ([...previousSlides, ...slideIds] as any)
    await payload.update({
      collection: 'modules',
      id: String(moduleId),
      data: { slides: nextSlides },
      overrideAccess: true,
      depth: 0,
    })

    return NextResponse.json(
      {
        success: true,
        slidesCreated,
        page_count: convert.page_count || images.length,
        replacedSlides: startPage <= 1 ? previousSlides.length : 0,
        totalPages,
        processed: imagesToProcess.map((i) => i.page),
        nextStartPage: endIdx < totalPages ? endIdx + 1 : null,
        batchSize,
      },
      { status: 200 },
    )
  } catch (e: any) {
    console.error('process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
