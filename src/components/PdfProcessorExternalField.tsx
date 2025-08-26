'use client'

import React, { useState, useEffect } from 'react'
import { useConfig, useDocumentInfo, useFormFields } from '@payloadcms/ui'

export const PdfProcessorExternalField: React.FC = () => {
  const { id: docId } = useDocumentInfo()
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<string>('')
  const [instruction, setInstruction] = useState('')
  const slides = useFormFields(([fields]) => fields?.slides)
  const hasSlides = slides?.value && Array.isArray(slides.value) && slides.value.length > 0
  const processModulePdf = async () => {
    if (!docId) {
      setResult('❌ No module ID available')
      return
    }

    setIsProcessing(true)
    
    // Delete existing slides if reprocessing
    if (hasSlides) {
      setResult('🗑️ Removing existing slides...')
      try {
        // Delete existing slides first
        const deleteResponse = await fetch('/api/delete-module-slides', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ moduleId: docId }),
        })
        
        if (!deleteResponse.ok) {
          console.warn('Failed to delete existing slides, continuing anyway...')
        }
      } catch (err) {
        console.warn('Error deleting slides:', err)
      }
    }
    
    setResult('🚀 Starting PDF processing...')

    try {
      const response = await fetch('/api/process-module-pdf-external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleId: docId,
          instruction: instruction || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResult(`❌ Error: ${data.error || 'Unknown error'}`)
        return
      }

      if (data.success) {
        setResult(
          `✅ ${data.message || 'Success!'}\n` +
            `📄 Pages processed: ${data.totalPages || data.pagesProcessed || 0}\n` +
            `🎯 Slides created: ${data.slidesCreated || data.slides_created || 0}\n` +
            `🔄 Refreshing page...`,
        )
        
        // Auto-reload after 2 seconds to show the new slides
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setResult(`❌ Processing failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      setResult(`❌ Network error: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #e1e5e9',
        borderRadius: '4px',
        backgroundColor: '#fafbfc',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <p style={{ margin: '0', color: '#6c757d', fontSize: '14px' }}>
            🚀 Upload a PDF file above, then click the button below to convert it into slides with
            images and AI-extracted content.
          </p>
        </div>
      </div>

      <button
        onClick={processModulePdf}
        disabled={isProcessing}
        style={{
          padding: '10px 20px',
          backgroundColor: isProcessing ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          opacity: isProcessing ? 0.7 : 1,
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.backgroundColor = '#0056b3'
          }
        }}
        onMouseLeave={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.backgroundColor = '#007bff'
          }
        }}
      >
        {isProcessing ? 'Processing...' : hasSlides ? 'Reprocess PDF' : 'Process PDF to Slides'}
      </button>

      {result && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: result.includes('❌') ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${result.includes('❌') ? '#fca5a5' : '#86efac'}`,
            borderRadius: '4px',
            fontSize: '14px',
            whiteSpace: 'pre-line',
            color: '#1f2937', // Dark gray text color
          }}
        >
          {result}
        </div>
      )}
    </div>
  )
}
