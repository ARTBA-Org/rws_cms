'use client'
import React, { useState, useMemo, useEffect } from 'react'

interface ProcessPdfButtonProps {
  path?: string
  data?: any
  user?: any
}

export default function ProcessPdfButton(props: ProcessPdfButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [autoProcessingStatus, setAutoProcessingStatus] = useState<string | null>(null)
  const [moduleData, setModuleData] = useState<any>(null)

  const moduleId = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    return idPart
  }, [])

  // Fetch current module data to understand context
  useEffect(() => {
    if (!moduleId) return

    const fetchModuleData = async () => {
      try {
        console.log('🔍 Fetching module data for ID:', moduleId)
        // Use Payload's built-in REST API
        const response = await fetch(`/api/modules/${moduleId}?depth=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for authentication
        })
        console.log('📋 Module fetch response:', response.status, response.statusText)

        if (response.ok) {
          const data = await response.json()
          console.log('📊 Module data received:', {
            id: data.id,
            hasPdf: !!data.pdfUpload,
            slidesCount: data.slides?.length || 0,
          })
          setModuleData(data)
        } else {
          console.error('❌ Failed to fetch module data:', response.status, response.statusText)
          // Set empty data to prevent infinite loading
          setModuleData({})
        }
      } catch (error) {
        console.error('❌ Error fetching module data:', error)
        // Set empty data to prevent infinite loading
        setModuleData({})
      }
    }

    fetchModuleData()
  }, [moduleId])

  // Check for automatic processing status
  useEffect(() => {
    if (!moduleId) return

    const checkAutoProcessing = async () => {
      try {
        const response = await fetch(`/api/pdf-processing-status/${moduleId}`)
        if (response.ok) {
          const status = await response.json()
          if (status.isProcessing) {
            setAutoProcessingStatus('🔄 Automatic processing in progress...')
          } else if (status.lastProcessed) {
            setAutoProcessingStatus(
              `✅ Last processed: ${new Date(status.lastProcessed).toLocaleString()}`,
            )
          }
        }
      } catch (error) {
        // Ignore errors - status check is optional
      }
    }

    checkAutoProcessing()

    // Check status every 5 seconds if processing
    const interval = setInterval(checkAutoProcessing, 5000)
    return () => clearInterval(interval)
  }, [moduleId])

  const handleProcessPdf = async () => {
    if (!moduleId) {
      setMessage('❌ Module ID not found')
      return
    }

    setIsProcessing(true)
    setMessage('🚀 Starting PDF processing...')
    console.log('🔧 Processing PDF for module:', moduleId)

    try {
      const response = await fetch('/api/process-module-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ moduleId }),
      })

      const result = await response.json()
      console.log('📋 API Response:', { status: response.status, result })

      if (response.ok) {
        const slidesCreated = result.result?.slidesCreated || result.slidesCreated || 0
        const aiAnalysisUsed = result.result?.aiAnalysisUsed || result.aiAnalysisUsed || false
        const slideTypes = result.result?.slideTypes || result.slideTypes || []

        let message = `✅ Success! Created ${slidesCreated} slides.`

        if (aiAnalysisUsed && slideTypes.length > 0) {
          const typeCounts = slideTypes.reduce((acc: Record<string, number>, type: string) => {
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {})

          const typesSummary = Object.entries(typeCounts)
            .map(([type, count]) => `${count} ${type}`)
            .join(', ')

          message += ` 🤖 AI analyzed: ${typesSummary}.`
        }

        message += ' Refresh the page to see them.'
        setMessage(message)

        // Auto-refresh after 4 seconds (longer to read AI summary)
        setTimeout(() => {
          window.location.reload()
        }, 4000)
      } else {
        setMessage(`❌ Error: ${result.error || 'Processing failed'}`)
        console.error('❌ Processing failed:', result)
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('❌ Network error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Determine current state
  const hasPdf = moduleData?.pdfUpload
  const hasSlides = moduleData?.slides && moduleData.slides.length > 0
  const isNewModule = !moduleId || moduleId === 'create'

  if (isNewModule) {
    return (
      <div
        style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}
      >
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          💡 Save the module first, then upload a PDF to automatically process it into slides.
        </p>
      </div>
    )
  }

  // Show loading state while fetching module data
  if (!moduleData) {
    return (
      <div
        style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}
      >
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>⏳ Loading module data...</p>
      </div>
    )
  }

  // No PDF uploaded yet
  if (!hasPdf) {
    return (
      <div
        style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}
      >
        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
          PDF Processing
        </h4>
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          📄 Upload a PDF using the field above to automatically convert it into slides.
        </p>
      </div>
    )
  }

  // Determine button text and description based on state
  const getButtonText = () => {
    if (isProcessing) return '⏳ Processing...'
    if (!hasSlides) return '🚀 Process PDF into Slides'
    return '🔄 Re-process PDF into Slides'
  }

  const getDescription = () => {
    if (!hasSlides) {
      return 'PDF uploaded. Click the button below to process it into slides.'
    }
    return `Found ${moduleData.slides.length} existing slides. You can re-process the PDF to update them.`
  }

  return (
    <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>PDF Processing</h4>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ margin: '0 0 8px 0', color: '#6c757d', fontSize: '14px' }}>
          📄 <strong>Status:</strong> {getDescription()}
        </p>

        {!hasSlides && (
          <p style={{ margin: '0 0 8px 0', color: '#6c757d', fontSize: '14px' }}>
            🤖 <strong>Automatic Processing:</strong> PDFs are automatically converted to slides
            when uploaded.
          </p>
        )}

        {autoProcessingStatus && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: autoProcessingStatus.includes('✅') ? '#d4edda' : '#fff3cd',
              color: autoProcessingStatus.includes('✅') ? '#155724' : '#856404',
              borderRadius: '4px',
              fontSize: '13px',
              border: `1px solid ${autoProcessingStatus.includes('✅') ? '#c3e6cb' : '#ffeaa7'}`,
              marginTop: '8px',
            }}
          >
            {autoProcessingStatus}
          </div>
        )}
      </div>

      <button
        onClick={handleProcessPdf}
        disabled={isProcessing}
        style={{
          padding: '12px 24px',
          backgroundColor: isProcessing ? '#6c757d' : hasSlides ? '#28a745' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          marginBottom: message ? '12px' : '0',
        }}
      >
        {getButtonText()}
      </button>

      {message && (
        <div
          style={{
            padding: '12px',
            backgroundColor: message.includes('❌')
              ? '#f8d7da'
              : message.includes('✅')
                ? '#d4edda'
                : '#d1ecf1',
            color: message.includes('❌')
              ? '#721c24'
              : message.includes('✅')
                ? '#155724'
                : '#0c5460',
            borderRadius: '4px',
            fontSize: '14px',
            border: `1px solid ${message.includes('❌') ? '#f5c6cb' : message.includes('✅') ? '#c3e6cb' : '#bee5eb'}`,
          }}
        >
          {message}
        </div>
      )}

      {/* Inline progress indicator */}
      {!isProcessing && !hasSlides && moduleId && (
        <div style={{ marginTop: 8 }}>
          <em style={{ color: '#6c757d', fontSize: 12 }}>
            After clicking Process, you can continue editing. We’ll show progress here.
          </em>
        </div>
      )}
    </div>
  )
}
