'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'

type Job = {
  id: string | number
  state: 'queued' | 'running' | 'success' | 'failed'
  pagesDone?: number
  pagesTotal?: number
  lastMessage?: string
}

export default function PdfProgress(props?: { moduleId?: string | number }) {
  const [job, setJob] = useState<Job | null>(null)
  const [derivedModuleId, setDerivedModuleId] = useState<string | number | undefined>(
    props?.moduleId,
  )
  const timerRef = useRef<number | null>(null)
  const noJobStreakRef = useRef<number>(0)

  // Derive moduleId from admin URL if not provided via props
  useEffect(() => {
    if (derivedModuleId) return
    if (typeof window === 'undefined') return
    const match = window.location.pathname.match(/\/admin\/collections\/modules\/(.+)$/)
    const idPart = match?.[1]
    if (!idPart || idPart === 'create') return
    // Use numeric if possible, else keep string
    const asNum = Number(idPart)
    setDerivedModuleId(Number.isNaN(asNum) ? idPart : asNum)
  }, [derivedModuleId])

  useEffect(() => {
    let active = true
    if (!derivedModuleId) return
    const tick = async () => {
      try {
        const res = await fetch(`/api/pdf-jobs?where[module][equals]=${derivedModuleId}&limit=1`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        const j = data?.docs?.[0]
        if (active) setJob(j || null)
        if (!j) {
          noJobStreakRef.current += 1
          // Stop polling after ~10s if no job exists
          if (noJobStreakRef.current >= 10) {
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
          }
          return
        }
        // Reset streak when a job is found
        noJobStreakRef.current = 0
        // Stop polling when job reaches a terminal state
        if (j && (j.state === 'success' || j.state === 'failed')) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }
      } catch {}
    }
    tick()
    timerRef.current = window.setInterval(tick, 1000)
    return () => {
      active = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      noJobStreakRef.current = 0
    }
  }, [derivedModuleId])

  if (!derivedModuleId) return null

  const pct = job && job.pagesTotal ? Math.round(((job.pagesDone || 0) / job.pagesTotal) * 100) : 0
  const state = job?.state || 'queued'
  const color = state === 'success' ? '#16a34a' : state === 'failed' ? '#dc2626' : '#2563eb'

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <strong>PDF Processing</strong>{' '}
        {job
          ? `${state.toUpperCase()} ${job.pagesTotal ? `• ${job.pagesDone}/${job.pagesTotal}` : ''}`
          : '• Waiting to start...'}
      </div>
      <div style={{ height: 6, background: '#334155', borderRadius: 4 }}>
        <div
          style={{
            height: 6,
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 300ms',
          }}
        />
      </div>
      {job?.lastMessage && (
        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{job.lastMessage}</div>
      )}
    </div>
  )
}
