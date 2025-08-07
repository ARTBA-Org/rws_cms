import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || ''
    const page = Number(url.searchParams.get('page') || '1')
    const limit = Number(url.searchParams.get('limit') || '10')

    if (!q.trim()) {
      return NextResponse.json({ docs: [], totalDocs: 0, page: 1, totalPages: 0 })
    }

    const payload = await getPayload({ config })

    // The Search plugin stores results in `search` collection
    const results = await payload.find({
      collection: 'search',
      page,
      limit,
      where: {
        or: [{ title: { like: q } }, { content: { like: q } }],
      },
    })

    return NextResponse.json(results)
  } catch (e: any) {
    console.error('search error:', e)
    return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 })
  }
}
