// In-memory storage for processing status (in production, use Redis or database)
const processingStatus = new Map<
  string,
  {
    isProcessing: boolean
    stage: 'idle' | 'loading' | 'converting' | 'creating' | 'complete' | 'error'
    currentPage?: number
    totalPages?: number
    slidesCreated?: number
    error?: string
    startTime?: number
  }
>()

export function updateProcessingStatus(
  moduleId: string,
  update: Partial<{
    isProcessing: boolean
    stage: 'idle' | 'loading' | 'converting' | 'creating' | 'complete' | 'error'
    currentPage?: number
    totalPages?: number
    slidesCreated?: number
    error?: string
    startTime?: number
  }>,
) {
  const current = processingStatus.get(moduleId) || {
    isProcessing: false,
    stage: 'idle' as const,
  }

  processingStatus.set(moduleId, { ...current, ...update })
}

export function getProcessingStatus(moduleId: string) {
  return (
    processingStatus.get(moduleId) || {
      isProcessing: false,
      stage: 'idle' as const,
    }
  )
}

export function clearProcessingStatus(moduleId: string) {
  processingStatus.delete(moduleId)
}
