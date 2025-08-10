'use client'
import React, { useState, useMemo } from 'react'

export default function ProcessPdfButtonSimple() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')

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
    setMessage('🚀 Starting PDF processing...')
    console.log('🔧 Processing PDF for module:', moduleId)

    try {
      const response = await fetch('/api/test-process-module-pdf', {
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

  if (!moduleId || moduleId === 'create') {
    return (
      <div
        style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}
      >
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          💡 Save the module first, then you can process PDFs into slides.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', margin: '16px 0' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>PDF Processing</h4>

      <p style={{ margin: '0 0 16px 0', color: '#6c757d', fontSize: '14px' }}>
        Upload a PDF using the field above, then click the button below to convert it into slides.
      </p>

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
          marginBottom: message ? '12px' : '0',
        }}
      >
        {isProcessing ? '⏳ Processing...' : '🚀 Process PDF into Slides'}
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
    </div>
  )
}
