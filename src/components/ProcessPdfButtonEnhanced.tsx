'use client'
import React, { useState, useMemo, useEffect } from 'react'

interface ProcessingStatus {
  isProcessing: boolean
  message: string
  progress?: {
    current: number
    total: number
    phase: 'extracting' | 'processing' | 'generating' | 'saving' | 'complete'
  }
  error?: string
  result?: {
    slidesCreated: number
    pagesProcessed: number
    totalPages: number
    partialSuccess?: boolean
    timeElapsed?: number
  }
}

export default function ProcessPdfButtonEnhanced() {
  const [status, setStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    message: ''
  })
  const [config, setConfig] = useState({
    maxPages: 5,
    enableImages: true,
    useOptimized: true
  })

  const moduleId = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    return idPart
  }, [])

  const handleProcessPdf = async () => {
    if (!moduleId) {
      setStatus({
        isProcessing: false,
        message: '❌ Module ID not found',
        error: 'Module ID not found'
      })
      return
    }

    setStatus({
      isProcessing: true,
      message: '🚀 Starting PDF processing...',
      progress: {
        current: 0,
        total: config.maxPages,
        phase: 'extracting'
      }
    })

    try {
      // Start processing with timeout configuration
      const timeoutMs = config.enableImages ? 55000 : 30000 // Adjust based on Lambda timeout
      
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
            batchSize: 1
          }
        }),
      })

      const result = await response.json()
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

        setStatus({
          isProcessing: false,
          message,
          result: {
            slidesCreated,
            pagesProcessed,
            totalPages,
            partialSuccess,
            timeElapsed
          },
          progress: {
            current: pagesProcessed,
            total: totalPages,
            phase: 'complete'
          }
        })

        // Auto-refresh after showing results
        if (slidesCreated > 0) {
          setTimeout(() => {
            window.location.reload()
          }, 3000)
        }
      } else {
        const errorMsg = result.error || result.errors?.[0] || 'Processing failed'
        setStatus({
          isProcessing: false,
          message: `❌ Error: ${errorMsg}`,
          error: errorMsg
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setStatus({
        isProcessing: false,
        message: `❌ Network error: ${errorMsg}`,
        error: errorMsg
      })
      console.error('❌ Network error:', error)
    }
  }

  if (!moduleId || moduleId === 'create') {
    return (
      <div className="pdf-processor-container">
        <p className="info-message">
          💡 Save the module first, then you can process PDFs into slides.
        </p>
      </div>
    )
  }

  const progressPercentage = status.progress 
    ? (status.progress.current / status.progress.total) * 100 
    : 0

  return (
    <div className="pdf-processor-container">
      <h4 className="section-title">PDF Processing</h4>

      <p className="section-description">
        Upload a PDF file here, then use the processing button below to convert it into slides.
      </p>

      {/* Configuration Options */}
      <div className="config-section">
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.enableImages}
              onChange={(e) => setConfig({ ...config, enableImages: e.target.checked })}
              disabled={status.isProcessing}
            />
            <span> Generate images from PDF pages</span>
          </label>
        </div>
        <div className="config-item">
          <label>
            Max pages to process:
            <select
              value={config.maxPages}
              onChange={(e) => setConfig({ ...config, maxPages: Number(e.target.value) })}
              disabled={status.isProcessing}
              style={{ marginLeft: '8px' }}
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
        disabled={status.isProcessing}
        className={`process-button ${status.isProcessing ? 'processing' : ''}`}
      >
        {status.isProcessing ? '⏳ Processing...' : '🚀 Process PDF into Slides'}
      </button>

      {/* Progress Bar */}
      {status.isProcessing && status.progress && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="progress-text">
            {status.progress.phase === 'extracting' && 'Extracting text from PDF...'}
            {status.progress.phase === 'processing' && `Processing page ${status.progress.current} of ${status.progress.total}...`}
            {status.progress.phase === 'generating' && 'Generating images...'}
            {status.progress.phase === 'saving' && 'Saving slides...'}
            {status.progress.phase === 'complete' && 'Complete!'}
          </p>
        </div>
      )}

      {/* Status Message */}
      {status.message && (
        <div className={`status-message ${
          status.message.includes('❌') ? 'error' : 
          status.message.includes('✅') ? 'success' : 
          status.message.includes('⚠️') ? 'warning' : 
          'info'
        }`}>
          {status.message}
          {status.result && status.result.partialSuccess && (
            <p className="status-detail">
              💡 Tip: Try processing fewer pages or disabling image generation for faster results.
            </p>
          )}
        </div>
      )}

      <style jsx>{`
        .pdf-processor-container {
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 16px 0;
        }

        .section-title {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .section-description {
          margin: 0 0 16px 0;
          color: #6c757d;
          font-size: 14px;
        }

        .info-message {
          margin: 0;
          color: #6c757d;
          font-size: 14px;
        }

        .config-section {
          margin-bottom: 16px;
          padding: 12px;
          background: white;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }

        .config-item {
          margin-bottom: 8px;
          font-size: 14px;
        }

        .config-item:last-child {
          margin-bottom: 0;
        }

        .config-item label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .config-item input[type="checkbox"] {
          margin-right: 8px;
        }

        .process-button {
          padding: 12px 24px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .process-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .process-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .progress-container {
          margin-top: 16px;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background-color: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background-color: #007bff;
          transition: width 0.3s ease;
        }

        .progress-text {
          margin-top: 8px;
          font-size: 12px;
          color: #6c757d;
          text-align: center;
        }

        .status-message {
          margin-top: 12px;
          padding: 12px;
          border-radius: 4px;
          font-size: 14px;
          border-width: 1px;
          border-style: solid;
        }

        .status-message.error {
          background-color: #f8d7da;
          color: #721c24;
          border-color: #f5c6cb;
        }

        .status-message.success {
          background-color: #d4edda;
          color: #155724;
          border-color: #c3e6cb;
        }

        .status-message.warning {
          background-color: #fff3cd;
          color: #856404;
          border-color: #ffeeba;
        }

        .status-message.info {
          background-color: #d1ecf1;
          color: #0c5460;
          border-color: #bee5eb;
        }

        .status-detail {
          margin: 8px 0 0 0;
          font-size: 12px;
          opacity: 0.9;
        }
      `}</style>
    </div>
  )
}