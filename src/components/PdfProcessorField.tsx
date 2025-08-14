'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { UIFieldClientComponent } from 'payload'

export const PdfProcessorField: UIFieldClientComponent = ({ path, field }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [hasPdf, setHasPdf] = useState<boolean>(false)
  const [checkedPdf, setCheckedPdf] = useState<boolean>(false)
  const [existingSlides, setExistingSlides] = useState<number>(0)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Simplified defaults: always generate images, use optimized processor
  const config = { maxPages: 5, enableImages: true, useOptimized: true }
  const [nextStartPage, setNextStartPage] = useState<number | null>(1)
  const nextStartPageRef = useRef<number | null>(1)

  // Keep ref in sync with state
  useEffect(() => {
    nextStartPageRef.current = nextStartPage
  }, [nextStartPage])

  const moduleId = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const pathname = window.location.pathname
    // Match both /admin/collections/modules/ID and /admin/collections/modules/ID/edit patterns
    const match = pathname.match(/\/admin\/collections\/modules\/(\d+)(?:\/|$)/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    return idPart
  }, [typeof window !== 'undefined' ? window.location.pathname : ''])

  // Check PDF and existing slides
  useEffect(() => {
    const checkModuleData = async () => {
      if (!moduleId) {
        setCheckedPdf(true)
        return
      }

      try {
        const res = await fetch(`/api/modules/${moduleId}?depth=1`, { cache: 'no-store' })
        if (res.ok) {
          const doc = await res.json()
          setHasPdf(!!doc?.pdfUpload)

          // Count existing slides
          const slideCount = Array.isArray(doc?.slides) ? doc.slides.length : 0
          setExistingSlides(slideCount)
        }
      } catch {
        setHasPdf(false)
        setExistingSlides(0)
      } finally {
        setCheckedPdf(true)
      }
    }

    checkModuleData()
  }, [moduleId])

  const handleProcessPdf = async (forceReplace = false) => {
    if (!moduleId) {
      setMessage('❌ Please save the module first')
      return
    }

    // If there are existing slides and user hasn't confirmed replacement
    if (existingSlides > 0 && !forceReplace) {
      setShowConfirmation(true)
      return
    }

    setIsProcessing(true)
    setShowConfirmation(false)

    if (existingSlides > 0) {
      setMessage('🗑️ Cleaning up existing slides and media... This may take a moment.')
    } else {
      setMessage(
        '🚀 Processing PDF... This may take a few moments. The page will automatically refresh when complete.',
      )
    }

    try {
      const timeoutMs = 55000
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
          replaceExisting: existingSlides > 0, // Tell server to clean up existing slides
        }),
      })

      let result: any = {}
      try {
        result = await response.json()
      } catch {
        result = { success: false, error: 'Empty response from server' }
      }

      if (response.ok && result.success) {
        const successMessage =
          existingSlides > 0
            ? `🎉 Successfully replaced ${existingSlides} old slides with ${result.slidesCreated || 0} new slides from ${result.totalPages || 0} pages!`
            : `🎉 Successfully created ${result.slidesCreated || 0} slides from ${result.totalPages || 0} pages!`
        setMessage(successMessage)

        // Check if there are more pages to process
        const currentStartPage = nextStartPageRef.current || 1
        if (result.nextStartPage && result.nextStartPage > currentStartPage) {
          setMessage(
            `📄 Processing continues... Created ${result.slidesCreated || 0} slides so far. Page will refresh when all pages are complete.`,
          )
          setNextStartPage(result.nextStartPage)
          setTimeout(() => {
            handleProcessPdf(true) // Skip confirmation on continuation
          }, 1000)
        } else {
          // All done - refresh the page
          setMessage(
            `✅ Processing complete! Created ${result.slidesCreated || 0} slides. Refreshing page...`,
          )
          setNextStartPage(1) // Reset for next run
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      } else {
        const statusText = `${response.status} ${response.statusText || ''}`.trim()
        const errorMsg =
          result.error ||
          result.errors?.[0] ||
          (response.ok ? 'Processing failed' : statusText || 'Network/timeout')
        setMessage(`❌ Error: ${errorMsg}`)
        setIsProcessing(false)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessage(`❌ Network error: ${errorMsg}`)
      setIsProcessing(false)
      console.error('❌ Network error:', error)
    }
  }

  // Show different states based on PDF availability
  if (!checkedPdf) {
    return (
      <div
        style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #007bff',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
            Checking for PDF upload...
          </p>
        </div>
      </div>
    )
  }

  if (!hasPdf) {
    return (
      <div
        style={{
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', color: '#856404', fontSize: '14px', fontWeight: '500' }}>
            No PDF uploaded
          </p>
          <p style={{ margin: 0, color: '#856404', fontSize: '12px' }}>
            Upload a PDF file above, save the module, then refresh this page to enable processing
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div
        style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
        }}
      >
        <div style={{ marginBottom: '15px' }}>
          <h4
            style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '600', color: '#495057' }}
          >
            PDF Processor
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#6c757d', lineHeight: '1.4' }}>
            Convert your PDF into individual slides with automated text extraction and image
            generation
          </p>

          {/* Show existing slides info */}
          {existingSlides > 0 && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
              }}
            >
              <p style={{ margin: 0, fontSize: '13px', color: '#495057', fontWeight: '500' }}>
                Current slides: {existingSlides}
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div
            style={{
              marginBottom: '15px',
              padding: '15px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <h5
                style={{
                  margin: '0 0 5px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#856404',
                }}
              >
                Replace Existing Slides?
              </h5>
              <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                This will delete all {existingSlides} existing slide
                {existingSlides !== 1 ? 's' : ''} and their associated media files, then create new
                slides from the PDF. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleProcessPdf(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Yes, Replace All Slides
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => handleProcessPdf()}
          disabled={isProcessing || showConfirmation}
          style={{
            padding: '14px 20px',
            backgroundColor:
              isProcessing || showConfirmation
                ? '#6c757d'
                : existingSlides > 0
                  ? '#fd7e14'
                  : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isProcessing || showConfirmation ? 'not-allowed' : 'pointer',
            margin: 0,
            transition: 'all 0.2s ease',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isProcessing ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Processing...
            </>
          ) : (
            <>{existingSlides > 0 ? 'Reprocess PDF (Replace Slides)' : 'Process PDF into Slides'}</>
          )}
        </button>

        {message && (
          <div
            style={{
              marginTop: '15px',
              padding: '12px',
              backgroundColor: message.includes('❌') ? '#f8d7da' : '#d4edda',
              border: `1px solid ${message.includes('❌') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '6px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: message.includes('❌') ? '#721c24' : '#155724',
                fontWeight: '500',
              }}
            >
              {message}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default PdfProcessorField
