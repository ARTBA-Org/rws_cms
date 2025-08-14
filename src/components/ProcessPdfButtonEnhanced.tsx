'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'

export default function ProcessPdfButtonEnhanced() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  // Simplified defaults: always generate images, use optimized processor
  const config = { maxPages: 5, enableImages: true, useOptimized: true }
  const [nextStartPage, setNextStartPage] = useState<number | null>(1)
  const nextStartPageRef = useRef<number | null>(1)
  const [hasPdf, setHasPdf] = useState<boolean>(false)
  const [checkedPdf, setCheckedPdf] = useState<boolean>(false)

  // Keep ref in sync with state
  useEffect(() => {
    nextStartPageRef.current = nextStartPage
  }, [nextStartPage])

  const moduleId = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    return idPart
  }, [])

  // Check if module has a PDF uploaded; only show button when it does
  useEffect(() => {
    const run = async () => {
      if (!moduleId) {
        setCheckedPdf(true)
        return
      }
      try {
        const res = await fetch(`/api/modules/${moduleId}?depth=0`, { cache: 'no-store' })
        if (res.ok) {
          const doc = await res.json()
          setHasPdf(!!doc?.pdfUpload)
        }
      } catch {
        // ignore
      } finally {
        setCheckedPdf(true)
      }
    }
    run()
  }, [moduleId])

  const handleProcessPdf = async () => {
    if (!moduleId) {
      setMessage('❌ Module ID not found')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setMessage('⏳ Processing...')
    console.log('🔧 Processing PDF for module:', moduleId)
    console.log('📄 Current nextStartPage state:', nextStartPage, 'ref:', nextStartPageRef.current)

    try {
      // Conservative timeout; server still enforces caps
      const timeoutMs = 55000

      // Use the ref value which is always up-to-date
      const startPage = nextStartPageRef.current || 1

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
          startPage,
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
        setMessage('⏳ Processing...')
        setProgress(100)
        // Progressive auto-continue for all cases
        const currentStartPage = nextStartPageRef.current || 1
        console.log(
          `🔍 Auto-continue check: nextStartPage=${nextStartPage}, ref=${nextStartPageRef.current}, currentStartPage=${currentStartPage}, result.nextStartPage=${result.nextStartPage}`,
        )
        if (result.nextStartPage && result.nextStartPage > currentStartPage) {
          console.log(`📄 Auto-continuing to page ${result.nextStartPage}...`)
          setNextStartPage(result.nextStartPage)
          // nextStartPageRef will be updated by the useEffect
          setTimeout(() => {
            console.log(`⏰ Auto-continue timer fired, calling handleProcessPdf()`)
            handleProcessPdf()
          }, 500)
        } else {
          console.log('✅ All pages processed — refreshing')
          setNextStartPage(1) // Reset for next run
          setTimeout(() => {
            window.location.reload()
          }, 800)
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

  // Debug logging
  console.log('ProcessPdfButtonEnhanced render check:', {
    moduleId,
    checkedPdf,
    hasPdf,
    shouldRender: !(!moduleId || !checkedPdf || !hasPdf),
  })

  // If module not ready or no PDF, render nothing
  if (!moduleId || !checkedPdf || !hasPdf) return null

  return (
    <div>
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
          margin: 0,
          transition: 'background-color 0.2s',
        }}
      >
        {isProcessing ? '⏳ Processing...' : '🚀 Process PDF into Slides'}
      </button>

      {isProcessing && null}
    </div>
  )
}
