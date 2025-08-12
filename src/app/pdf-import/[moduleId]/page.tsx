'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface ProcessingStatus {
  isProcessing: boolean
  progress: number
  message: string
  error?: string
}

export default function PDFImportPage() {
  const params = useParams()
  const moduleId = params?.moduleId as string
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    message: 'Ready to process PDF',
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      setStatus({
        isProcessing: false,
        progress: 0,
        message: `Selected: ${selectedFile.name}`,
      })
    } else {
      alert('Please select a valid PDF file')
    }
  }

  const handleProcessPDF = async () => {
    if (!file || !moduleId) {
      alert('Please select a PDF file first')
      return
    }

    setStatus({
      isProcessing: true,
      progress: 10,
      message: 'Starting PDF processing...',
    })

    try {
      // Hardcoded production check
      const isProduction =
        window.location.hostname.includes('amplifyapp.com') ||
        window.location.hostname.includes('cloudfront.net') ||
        window.location.hostname.includes('amazonaws.com') ||
        (!window.location.hostname.includes('localhost') &&
          !window.location.hostname.includes('127.0.0.1'))

      if (isProduction) {
        setStatus({
          isProcessing: false,
          progress: 0,
          message: 'PDF processing is currently disabled in production environment',
          error:
            'This feature requires additional server-side dependencies that are not available in the current deployment environment.',
        })
        return
      }

      // For development/local environment
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('moduleId', moduleId)

      setStatus({
        isProcessing: true,
        progress: 30,
        message: 'Uploading PDF...',
      })

      const response = await fetch('/api/process-module-pdf', {
        method: 'POST',
        body: JSON.stringify({ moduleId }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setStatus({
        isProcessing: true,
        progress: 70,
        message: 'Processing PDF pages...',
      })

      const result = await response.json()

      if (result.success) {
        setStatus({
          isProcessing: false,
          progress: 100,
          message: `Successfully created ${result.slidesCreated} slides!`,
        })
      } else {
        throw new Error(result.error || 'Processing failed')
      }
    } catch (error) {
      console.error('PDF processing error:', error)
      setStatus({
        isProcessing: false,
        progress: 0,
        message: 'Processing failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1>PDF to Slides Converter</h1>

      {moduleId && (
        <div
          style={{
            background: '#f0f9ff',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #0ea5e9',
          }}
        >
          <strong>Module ID:</strong> {moduleId}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
          }}
        >
          Upload a PDF file here, then use the processing button below to convert it into slides.
        </label>

        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={{
            width: '100%',
            padding: '12px',
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
          }}
        />
      </div>

      {file && (
        <div style={{ marginBottom: '20px' }}>
          <p>
            Upload a PDF using the field above, then click the button below to convert it into
            slides.
          </p>

          <button
            onClick={handleProcessPDF}
            disabled={status.isProcessing}
            style={{
              padding: '12px 24px',
              backgroundColor: status.isProcessing ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: status.isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {status.isProcessing ? '⏳' : '🚀'} Process PDF into Slides
          </button>
        </div>
      )}

      {/* Status Display */}
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: status.error
            ? '#fef2f2'
            : status.progress === 100
              ? '#f0fdf4'
              : '#f8fafc',
          border: `1px solid ${status.error ? '#fecaca' : status.progress === 100 ? '#bbf7d0' : '#e2e8f0'}`,
          marginTop: '20px',
        }}
      >
        {status.error ? (
          <div>
            <div style={{ color: '#dc2626', fontWeight: '500', marginBottom: '8px' }}>
              ❌ Error: {status.error}
            </div>
            <div style={{ color: '#7f1d1d' }}>{status.message}</div>
          </div>
        ) : (
          <div>
            <div
              style={{
                color: status.progress === 100 ? '#16a34a' : '#374151',
                fontWeight: '500',
                marginBottom: status.isProcessing ? '8px' : '0',
              }}
            >
              {status.progress === 100 ? '✅' : status.isProcessing ? '⏳' : 'ℹ️'} {status.message}
            </div>

            {status.isProcessing && (
              <div style={{ marginTop: '8px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${status.progress}%`,
                      height: '100%',
                      backgroundColor: '#3b82f6',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '4px',
                  }}
                >
                  {status.progress}% complete
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(window.location.hostname.includes('amplifyapp.com') ||
        window.location.hostname.includes('cloudfront.net') ||
        window.location.hostname.includes('amazonaws.com') ||
        (!window.location.hostname.includes('localhost') &&
          !window.location.hostname.includes('127.0.0.1'))) && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ color: '#92400e', margin: '0 0 8px 0' }}>Production Environment Notice</h3>
          <p style={{ color: '#78350f', margin: '0', fontSize: '14px' }}>
            PDF processing functionality is currently disabled in the production environment due to
            server-side dependency requirements. This feature works fully in development mode.
          </p>
        </div>
      )}
    </div>
  )
}
