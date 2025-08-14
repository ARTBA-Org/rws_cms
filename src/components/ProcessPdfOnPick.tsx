'use client'
import React, { useMemo, useState } from 'react'
import type { FieldProps } from 'payload/components/forms'

export default function ProcessPdfOnPick(props: FieldProps) {
  const { value, onChange } = props
  const [busy, setBusy] = useState(false)

  // Allow PDF processing on localhost and Amplify environments
  const isProduction = useMemo(() => {
    if (typeof window === 'undefined') return false // Allow on server
    const hostname = window.location.hostname.toLowerCase()
    console.log('🔍 ProcessPdfOnPick hostname:', hostname)
    // Allow localhost, 127.0.0.1, and Amplify environments
    const isDevelopment = hostname === 'localhost' || 
                         hostname === '127.0.0.1' || 
                         hostname.includes('amplifyapp.com') ||
                         hostname.includes('amazonaws.com')
    const production = !isDevelopment
    console.log('🔍 ProcessPdfOnPick isProduction:', production)
    return production
  }, [])

  const moduleId = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return undefined
    const asNum = Number(idPart)
    return Number.isNaN(asNum) ? idPart : asNum
  }, [])

  const handleChange = async (val: any) => {
    onChange?.(val)

    // Check if we're in production
    if (isProduction) {
      console.warn('PDF processing is disabled in production environment')
      return
    }

    // Extract module ID from admin path if possible
    try {
      const pdfId = typeof val === 'object' ? (val as any)?.id : val
      if (moduleId && pdfId) {
        setBusy(true)
        // Fire and forget trigger
        fetch('/api/process-module-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId }),
        })
          .catch((e) => console.warn('PDF process error:', e))
          .finally(() => setBusy(false))
      }
    } catch {}
  }

  // Render the default upload field by delegating to Payload's default renderer
  // but intercept value changes. We wrap children via clone.
  // Fallback: simple input to avoid admin crash if default not provided.
  return (
    <div style={{ marginTop: 8 }}>
      {typeof props?.renderField === 'function' ? (
        props.renderField({ ...props, onChange: handleChange })
      ) : (
        <input
          type="text"
          value={typeof value === 'object' ? ((value as any)?.id ?? '') : (value ?? '')}
          onChange={(e) => handleChange(e.target.value)}
        />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        {isProduction ? (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#6b7280',
              color: 'white',
              fontSize: '12px',
            }}
          >
            ℹ️ PDF processing unavailable
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !moduleId || !value}
            onClick={() => handleChange(value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#2563eb',
              color: 'white',
              border: 'none',
              cursor: busy || !moduleId || !value ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Starting…' : 'Create slides now'}
          </button>
        )}
        <small style={{ color: isProduction ? '#6b7280' : '#374151' }}>
          {isProduction
            ? 'PDF processing requires server-side dependencies not available in deployed environments'
            : 'Automatically triggers when you pick a PDF; or click to start.'}
        </small>
      </div>
    </div>
  )
}
