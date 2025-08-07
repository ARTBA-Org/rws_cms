'use client'
import React from 'react'
import type { FieldProps } from 'payload/components/forms'

export default function ProcessPdfOnPick(props: FieldProps) {
  const { path, value, onChange, schemaPath } = props

  const handleChange = async (val: any) => {
    onChange?.(val)

    // Extract module ID from admin path if possible
    try {
      const match = window.location.pathname.match(/\/admin\/collections\/modules\/(\d+)/)
      const moduleId = match?.[1]
      const pdfId = typeof val === 'object' ? (val as any)?.id : val
      if (moduleId && pdfId) {
        // Fire and forget trigger
        fetch('/api/process-module-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              console.warn('PDF process failed:', data)
            }
          })
          .catch((e) => console.warn('PDF process error:', e))
      }
    } catch {}
  }

  // Render the default upload field by delegating to Payload's default renderer
  // but intercept value changes. We wrap children via clone.
  // Fallback: simple input to avoid admin crash if default not provided.
  if (typeof props?.renderField === 'function') {
    return props.renderField({ ...props, onChange: handleChange })
  }

  return (
    <div>
      <input
        type="text"
        value={typeof value === 'object' ? ((value as any)?.id ?? '') : (value ?? '')}
        onChange={(e) => handleChange(e.target.value)}
      />
      <small>Auto-processes PDF on selection.</small>
    </div>
  )
}
