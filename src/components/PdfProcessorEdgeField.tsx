'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { UIFieldClientComponent } from 'payload'

export const PdfProcessorEdgeField: UIFieldClientComponent = ({ path, field, ...props }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [hasPdf, setHasPdf] = useState<boolean>(false)
  const [checkedPdf, setCheckedPdf] = useState<boolean>(false)
  const [existingSlides, setExistingSlides] = useState<number>(0)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')
  const [processingMethod, setProcessingMethod] = useState<'edge' | 'local'>('edge')
  const [edgeHealthy, setEdgeHealthy] = useState<boolean | null>(null)

  // Track URL changes for better detection
  useEffect(() => {
    const updateUrl = () => {
      if (typeof window !== 'undefined') {
        setCurrentUrl(window.location.href)
      }
    }

    updateUrl()
    window.addEventListener('popstate', updateUrl)
    window.addEventListener('pushstate', updateUrl)
    window.addEventListener('replacestate', updateUrl)

    return () => {
      window.removeEventListener('popstate', updateUrl)
      window.removeEventListener('pushstate', updateUrl)
      window.removeEventListener('replacestate', updateUrl)
    }
  }, [])

  // Extract module ID from URL or props
  const moduleId = useMemo(() => {
    console.log('🔍 PDF Processor Module ID Detection:', {
      currentUrl,
      detectedId: undefined,
      windowLocation: typeof window !== 'undefined' ? window.location.href : 'undefined',
      propsKeys: Object.keys(props),
      propsValues: Object.fromEntries(
        Object.entries(props)
          .filter(([key]) => !['field', 'path'].includes(key))
          .reduce((acc, [key, value]) => {
            acc[key] = typeof value === 'object' && value !== null
              ? Array.isArray(value) 
                ? `Array(${value.length})`
                : Object.keys(value).length > 5
                  ? `Object(${Object.keys(value).length} keys)`
                  : value
              : value
            return acc
          }, {} as any)
      ),
    })

    if (typeof window === 'undefined') return undefined
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    return idPart
  }, [currentUrl, props])

  // Check Edge Function health on component mount
  useEffect(() => {
    const checkEdgeHealth = async () => {
      try {
        const response = await fetch('/api/process-pdf-edge', {
          method: 'GET',
        })
        const healthData = await response.json()
        setEdgeHealthy(healthData.edgeFunction?.available || false)
        
        // Auto-select processing method based on health
        if (healthData.edgeFunction?.available) {
          setProcessingMethod('edge')
        } else {
          setProcessingMethod('local')
        }
      } catch (error) {
        console.error('🏥 Edge Function health check failed:', error)
        setEdgeHealthy(false)
        setProcessingMethod('local')
      }
    }

    checkEdgeHealth()
  }, [])

  // Check PDF and existing slides
  useEffect(() => {
    const checkModuleData = async () => {
      if (!moduleId) {
        console.log('🔍 No moduleId detected, resetting state')
        setCheckedPdf(true)
        setHasPdf(false)
        setExistingSlides(0)
        return
      }

      console.log('🔍 Checking module data for ID:', moduleId)

      // Reset state before checking
      setCheckedPdf(false)
      setHasPdf(false)
      setExistingSlides(0)

      try {
        // Add timestamp to prevent caching issues
        const timestamp = Date.now()
        const url = `/api/modules/${moduleId}?depth=1&t=${timestamp}`
        console.log('🔍 Fetching from:', url)

        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })

        console.log('🔍 API Response status:', res.status, res.statusText)

        if (res.ok) {
          const doc = await res.json()
          console.log('🔍 Module data received:', {
            id: doc.id,
            hasPdfUpload: !!doc?.pdfUpload,
            pdfUploadType: typeof doc?.pdfUpload,
            pdfUploadValue: doc?.pdfUpload,
            slidesCount: Array.isArray(doc?.slides) ? doc.slides.length : 0,
          })

          const hasPdfFile = !!doc?.pdfUpload
          setHasPdf(hasPdfFile)

          // Count existing slides
          const slideCount = Array.isArray(doc?.slides) ? doc.slides.length : 0
          setExistingSlides(slideCount)

          console.log('🔍 State updated:', { hasPdf: hasPdfFile, existingSlides: slideCount })
        } else {
          console.log('🔍 API request failed:', res.status, res.statusText)
          setHasPdf(false)
          setExistingSlides(0)
        }
      } catch (error) {
        console.error('🔍 Error fetching module data:', error)
        setHasPdf(false)
        setExistingSlides(0)
      }

      setCheckedPdf(true)
    }

    checkModuleData()
  }, [moduleId, currentUrl])

  const handleProcessPdf = async () => {
    if (!moduleId) {
      setMessage('❌ Module ID not found')
      return
    }

    if (!hasPdf) {
      setMessage('❌ No PDF uploaded. Please upload a PDF first.')
      return
    }

    setIsProcessing(true)
    setMessage('🚀 Starting PDF processing...')

    try {
      console.log(`📋 Processing PDF using ${processingMethod} method...`)
      
      const response = await fetch('/api/process-pdf-edge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleId,
          replaceExisting: true, // Always replace existing slides
          useEdgeFunction: processingMethod === 'edge',
          processorConfig: {
            maxPages: 25,
            timeoutMs: processingMethod === 'edge' ? 120000 : 45000,
            enableImages: true,
            enableAI: true,
          },
        }),
      })

      const result = await response.json()
      console.log('📋 Processing result:', result)

      if (result.success) {
        const slidesCreated = result.slidesCreated || 0
        const method = result.method || processingMethod
        
        setMessage(
          `✅ Success! Created ${slidesCreated} slides using ${method === 'edge-function' ? 'Edge Function' : 'Local Processing'}. Refresh the page to see them.`
        )
        
        // Auto-refresh after 3 seconds
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      } else {
        const errorMsg = result.error || 'Processing failed'
        setMessage(`❌ Error: ${errorMsg}`)
        console.error('❌ Processing failed:', result)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error'
      setMessage(`❌ Network error: ${errorMsg}`)
      console.error('❌ Network error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!checkedPdf) {
    return (
      <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}>
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          🔍 Loading PDF processor...
        </p>
      </div>
    )
  }

  if (!moduleId || moduleId === 'create') {
    return (
      <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}>
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          💡 Save the module first, then you can process PDFs into slides.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px', margin: '16px 0' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
          🚀 Enhanced PDF Processor
        </h3>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          Convert your PDF into individual slides with automated text extraction and image generation
        </p>
      </div>

      {/* Processing Method Selection */}
      <div style={{ marginBottom: '16px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
          Processing Method:
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="radio"
              value="edge"
              checked={processingMethod === 'edge'}
              onChange={(e) => setProcessingMethod(e.target.value as 'edge' | 'local')}
              disabled={edgeHealthy === false}
            />
            <span style={{ fontSize: '14px' }}>
              🚀 Edge Function {edgeHealthy === null ? '(checking...)' : edgeHealthy ? '(available)' : '(unavailable)'}
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="radio"
              value="local"
              checked={processingMethod === 'local'}
              onChange={(e) => setProcessingMethod(e.target.value as 'edge' | 'local')}
            />
            <span style={{ fontSize: '14px' }}>🏠 Local Processing</span>
          </label>
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
          {processingMethod === 'edge' 
            ? 'Uses Supabase Edge Functions for better scalability and performance'
            : 'Uses the current local processing system'
          }
        </p>
      </div>

      {/* Current Status */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
          <strong>Current slides:</strong> {existingSlides}
        </div>
        {!hasPdf && (
          <div style={{ color: '#dc3545', fontSize: '14px', marginBottom: '8px' }}>
            ⚠️ No PDF uploaded. Please upload a PDF file first.
          </div>
        )}
      </div>

      {/* Processing Button */}
      <button
        onClick={handleProcessPdf}
        disabled={isProcessing || !hasPdf}
        style={{
          width: '100%',
          padding: '12px 24px',
          backgroundColor: isProcessing ? '#6c757d' : hasPdf ? '#007bff' : '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: isProcessing || !hasPdf ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        {isProcessing ? (
          <>
            ⏳ Processing PDF...
          </>
        ) : hasPdf ? (
          existingSlides > 0 ? (
            `🔄 Reprocess PDF (Replace ${existingSlides} Slides)`
          ) : (
            '🚀 Process PDF into Slides'
          )
        ) : (
          '❌ No PDF Available'
        )}
      </button>

      {/* Status Message */}
      {message && (
        <div 
          style={{ 
            marginTop: '16px', 
            padding: '12px', 
            borderRadius: '8px',
            backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#fff3cd',
            color: message.includes('✅') ? '#155724' : message.includes('❌') ? '#721c24' : '#856404',
            border: `1px solid ${message.includes('✅') ? '#c3e6cb' : message.includes('❌') ? '#f5c6cb' : '#ffeaa7'}`,
            fontSize: '14px',
          }}
        >
          {message}
        </div>
      )}

      {/* Method Comparison */}
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <details>
          <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
            📊 Processing Method Comparison
          </summary>
          <div style={{ paddingLeft: '16px' }}>
            <p><strong>🚀 Edge Function:</strong></p>
            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
              <li>Better scalability and performance</li>
              <li>Processes multiple pages concurrently</li>
              <li>Uses Deno runtime for better resource management</li>
              <li>Background task support for long-running operations</li>
            </ul>
            <p><strong>🏠 Local Processing:</strong></p>
            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
              <li>Uses current proven system</li>
              <li>Processes pages in small batches</li>
              <li>Full control over processing pipeline</li>
              <li>No external dependencies</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  )
}
