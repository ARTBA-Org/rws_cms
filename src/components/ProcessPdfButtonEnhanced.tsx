'use client'
import React, { useState, useMemo } from 'react'

export default function ProcessPdfButtonEnhanced() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [config, setConfig] = useState({
    maxPages: 5,
    enableImages: true,
    useOptimized: true,
  })
  const [nextStartPage, setNextStartPage] = useState<number | null>(1)

  const moduleId = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    return idPart
  }, [])

  const handleProcessPdf = async () => {
    if (!moduleId) {
      setMessage('❌ Module ID not found')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setMessage('🚀 Starting PDF processing...')
    console.log('🔧 Processing PDF for module:', moduleId)

    try {
      // Configure timeout based on settings
      const timeoutMs = config.enableImages ? 55000 : 30000

      const response = await fetch('/api/test-process-module-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleId,
          useOptimized: config.useOptimized,
          processorConfig: {
            maxPages: config.maxPages,
            timeoutMs,
            enableImages: config.enableImages,
            batchSize: 1,
          },
          startPage: nextStartPage || 1,
        }),
      })

      let result: any = {}
      try {
        result = await response.json()
      } catch {
        // Handle empty body (e.g., 204/timeout) gracefully
        result = { success: false, error: 'Empty response from server' }
      }
      console.log('📋 API Response:', { status: response.status, result })

      if (response.ok && result.success) {
        const { slidesCreated, pagesProcessed, totalPages, partialSuccess, timeElapsed } = result

        let message = `✅ Successfully created ${slidesCreated} slides`

        if (partialSuccess) {
          message = `⚠️ Partial success: Created ${slidesCreated} slides from ${pagesProcessed}/${totalPages} pages`
        } else if (pagesProcessed === totalPages) {
          message = `✅ Complete! All ${slidesCreated} slides created from ${totalPages} pages`
        }

        if (timeElapsed) {
          message += ` (${(timeElapsed / 1000).toFixed(1)}s)`
        }

        setMessage(message)
        setProgress(100)
        // Handle progressive paging
        if (result.nextStartPage) {
          setNextStartPage(result.nextStartPage)
          setTimeout(() => {
            handleProcessPdf()
          }, 500)
        } else {
          setNextStartPage(null)
          if (slidesCreated > 0) {
            setTimeout(() => {
              window.location.reload()
            }, 2000)
          }
        }
      } else {
        const statusText = `${response.status} ${response.statusText || ''}`.trim()
        const errorMsg =
          result.error ||
          result.errors?.[0] ||
          (response.ok ? 'Processing failed' : statusText || 'Network/timeout')
        setMessage(`❌ Error: ${errorMsg}`)
        setProgress(0)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessage(`❌ Network error: ${errorMsg}`)
      setProgress(0)
      console.error('❌ Network error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!moduleId || moduleId === 'create') {
    return (
      <div
        style={{
          padding: '16px',
          background: '#f8f9fa',
          borderRadius: '8px',
          margin: '16px 0',
        }}
      >
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          💡 Save the module first, then you can process PDFs into slides.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px',
        margin: '16px 0',
      }}
    >
      <h4
        style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: '600',
        }}
      >
        PDF Processing
      </h4>

      <p
        style={{
          margin: '0 0 16px 0',
          color: '#6c757d',
          fontSize: '14px',
        }}
      >
        Upload a PDF file here, then use the processing button below to convert it into slides.
      </p>

      {/* Configuration Options */}
      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          background: 'white',
          borderRadius: '4px',
          border: '1px solid #dee2e6',
        }}
      >
        <div style={{ marginBottom: '8px', fontSize: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.enableImages}
              onChange={(e) => setConfig({ ...config, enableImages: e.target.checked })}
              disabled={isProcessing}
              style={{ marginRight: '8px' }}
            />
            <span>Generate images from PDF pages</span>
          </label>
        </div>
        <div style={{ fontSize: '14px' }}>
          <label>
            Max pages to process:
            <select
              value={config.maxPages}
              onChange={(e) => setConfig({ ...config, maxPages: Number(e.target.value) })}
              disabled={isProcessing}
              style={{
                marginLeft: '8px',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
              }}
            >
              <option value={2}>2 pages (fast)</option>
              <option value={5}>5 pages (standard)</option>
              <option value={10}>10 pages</option>
              <option value={20}>20 pages</option>
            </select>
          </label>
        </div>
      </div>

      <button
        onClick={handleProcessPdf}
        disabled={isProcessing}
        style={{
          padding: '12px 24px',
          backgroundColor: isProcessing ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          marginBottom: message || isProcessing ? '12px' : '0',
          transition: 'background-color 0.2s',
        }}
      >
        {isProcessing ? '⏳ Processing...' : '🚀 Process PDF into Slides'}
      </button>

      {/* Progress Bar */}
      {isProcessing && (
        <div style={{ marginTop: '16px' }}>
          <div
            style={{
              width: '100%',
              height: '20px',
              backgroundColor: '#e9ecef',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress || 10}%`,
                height: '100%',
                backgroundColor: '#007bff',
                transition: 'width 0.3s ease',
                animation: progress === 0 ? 'pulse 2s infinite' : 'none',
              }}
            />
          </div>
          <p
            style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#6c757d',
              textAlign: 'center',
            }}
          >
            Processing PDF pages...
          </p>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div
          style={{
            padding: '12px',
            backgroundColor: message.includes('❌')
              ? '#f8d7da'
              : message.includes('✅')
                ? '#d4edda'
                : message.includes('⚠️')
                  ? '#fff3cd'
                  : '#d1ecf1',
            color: message.includes('❌')
              ? '#721c24'
              : message.includes('✅')
                ? '#155724'
                : message.includes('⚠️')
                  ? '#856404'
                  : '#0c5460',
            borderRadius: '4px',
            fontSize: '14px',
            border: `1px solid ${
              message.includes('❌')
                ? '#f5c6cb'
                : message.includes('✅')
                  ? '#c3e6cb'
                  : message.includes('⚠️')
                    ? '#ffeeba'
                    : '#bee5eb'
            }`,
          }}
        >
          {message}
          {message.includes('⚠️') && (
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              💡 Tip: Try processing fewer pages or disabling image generation for faster results.
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
