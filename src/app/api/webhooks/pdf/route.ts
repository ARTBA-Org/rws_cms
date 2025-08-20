import { NextRequest, NextResponse } from 'next/server'
import { webhookManager } from '../../../../utils/webhookManager'

// POST - Register a webhook
export async function POST(request: NextRequest) {
  try {
    const { 
      key, 
      url, 
      secret, 
      timeout = 10000, 
      retries = 3, 
      headers = {} 
    } = await request.json()

    if (!key || !url) {
      return NextResponse.json({ 
        error: 'key and url are required' 
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ 
        error: 'Invalid URL format' 
      }, { status: 400 })
    }

    webhookManager.registerWebhook(key, {
      url,
      secret,
      timeout,
      retries,
      headers,
    })

    return NextResponse.json({
      success: true,
      message: `Webhook registered for ${key}`,
      key,
      url,
    })

  } catch (error: any) {
    console.error('📡 Webhook registration error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to register webhook' 
    }, { status: 500 })
  }
}

// GET - List registered webhooks
export async function GET() {
  try {
    const stats = webhookManager.getStats()
    
    return NextResponse.json({
      success: true,
      ...stats,
      timestamp: Date.now(),
    })

  } catch (error: any) {
    console.error('📡 Webhook list error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to list webhooks' 
    }, { status: 500 })
  }
}

// DELETE - Unregister a webhook
export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json()

    if (!key) {
      return NextResponse.json({ 
        error: 'key is required' 
      }, { status: 400 })
    }

    webhookManager.unregisterWebhook(key)

    return NextResponse.json({
      success: true,
      message: `Webhook unregistered for ${key}`,
      key,
    })

  } catch (error: any) {
    console.error('📡 Webhook unregistration error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to unregister webhook' 
    }, { status: 500 })
  }
}