'use client'
import React, { useState, useEffect } from 'react'
import styles from './ProcessPdfOnPick.module.css'

interface ProcessingStatus {
  isProcessing: boolean
  stage: 'idle' | 'loading' | 'converting' | 'creating' | 'complete' | 'error'
  currentPage?: number
  totalPages?: number
  slidesCreated?: number
  error?: string
  startTime?: number
}

interface PdfProcessingNotificationProps {
  moduleId: string | number
}

export default function PdfProcessingNotification({ moduleId }: PdfProcessingNotificationProps) {
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, stage: 'idle' })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!moduleId) return

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/pdf-processing-status/${moduleId}`)
        if (response.ok) {
          const statusData = await response.json()
          setStatus(statusData)
          setIsVisible(
            statusData.isProcessing ||
              statusData.stage === 'complete' ||
              statusData.stage === 'error',
          )
        }
      } catch (error) {
        console.warn('Failed to poll processing status:', error)
      }
    }

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000)

    // Initial poll
    pollStatus()

    return () => clearInterval(interval)
  }, [moduleId])

  const getStatusMessage = () => {
    switch (status.stage) {
      case 'loading':
        return 'Loading PDF document...'
      case 'converting':
        return status.currentPage && status.totalPages
          ? `Converting page ${status.currentPage} of ${status.totalPages}...`
          : 'Converting PDF pages to images...'
      case 'creating':
        return 'Creating slides from images...'
      case 'complete':
        return `✅ Successfully created ${status.slidesCreated || 0} slides!`
      case 'error':
        return `❌ Error: ${status.error || 'Processing failed'}`
      default:
        return ''
    }
  }

  const getProgressPercentage = () => {
    if (!status.currentPage || !status.totalPages) return 0
    return Math.round((status.currentPage / status.totalPages) * 100)
  }

  if (!isVisible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        maxWidth: 400,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {status.isProcessing && <div className={styles.spinner} />}
        <span style={{ fontWeight: 600, color: '#1e293b' }}>
          {status.isProcessing
            ? 'Processing PDF'
            : status.stage === 'complete'
              ? 'Processing Complete'
              : 'Processing Error'}
        </span>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: 8, color: '#475569', fontSize: '14px' }}>
        {getStatusMessage()}
      </div>

      {/* Progress Bar */}
      {status.currentPage && status.totalPages && (
        <div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${getProgressPercentage()}%` }} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            <span>
              Page {status.currentPage} of {status.totalPages}
            </span>
            <span>{getProgressPercentage()}%</span>
          </div>
        </div>
      )}

      {status.stage === 'complete' && (
        <div style={{ marginTop: 8, fontSize: '12px', color: '#059669' }}>
          Page will refresh automatically to show new slides...
        </div>
      )}
    </div>
  )
}
