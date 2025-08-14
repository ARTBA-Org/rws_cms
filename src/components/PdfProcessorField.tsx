'use client'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { UIFieldClientComponent } from 'payload'

export const PdfProcessorField: UIFieldClientComponent = ({ path, field, ...props }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [hasPdf, setHasPdf] = useState<boolean>(false)
  const [checkedPdf, setCheckedPdf] = useState<boolean>(false)
  const [existingSlides, setExistingSlides] = useState<number>(0)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')

  // Simplified defaults: always generate images, use optimized processor
  const config = { maxPages: 5, enableImages: true, useOptimized: true }
  const [nextStartPage, setNextStartPage] = useState<number | null>(1)
  const nextStartPageRef = useRef<number | null>(1)

  // Keep ref in sync with state
  useEffect(() => {
    nextStartPageRef.current = nextStartPage
  }, [nextStartPage])

  // Track URL changes for better detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateUrl = () => {
        const newUrl = window.location.pathname + window.location.search
        setCurrentUrl(newUrl)
      }

      updateUrl() // Set initial URL

      // Listen for navigation changes
      window.addEventListener('popstate', updateUrl)

      // Also listen for pushstate/replacestate (for SPA navigation)
      const originalPushState = window.history.pushState
      const originalReplaceState = window.history.replaceState

      window.history.pushState = function (...args) {
        originalPushState.apply(window.history, args)
        setTimeout(updateUrl, 100) // Small delay to ensure DOM is updated
      }

      window.history.replaceState = function (...args) {
        originalReplaceState.apply(window.history, args)
        setTimeout(updateUrl, 100) // Small delay to ensure DOM is updated
      }

      return () => {
        window.removeEventListener('popstate', updateUrl)
        window.history.pushState = originalPushState
        window.history.replaceState = originalReplaceState
      }
    }
  }, [])

  // Try to get module ID from various sources
  const getModuleIdFromContext = () => {
    // Method 1: From URL
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname
      const match = pathname.match(/\/admin\/collections\/modules\/(\d+)(?:\/|$)/)
      if (match?.[1] && match[1] !== 'create') {
        return match[1]
      }
    }

    // Method 2: From props or context (if available)
    if (props && typeof props === 'object') {
      const propsObj = props as any
      if (propsObj.id || propsObj.docID || propsObj.documentID) {
        return String(propsObj.id || propsObj.docID || propsObj.documentID)
      }
    }

    return undefined
  }

  const moduleId = useMemo(() => {
    const detectedId = getModuleIdFromContext()

    console.log('🔍 PDF Processor Module ID Detection:', {
      currentUrl,
      detectedId,
      windowLocation: typeof window !== 'undefined' ? window.location.href : 'undefined',
      propsKeys: props ? Object.keys(props) : [],
      propsValues: props
        ? Object.entries(props).reduce((acc, [key, value]) => {
            // Only log simple values to avoid circular references
            if (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ) {
              acc[key] = value
            } else {
              acc[key] = typeof value
            }
            return acc
          }, {} as any)
        : {},
    })

    return detectedId
  }, [currentUrl, props])

  // Check PDF and existing slides
  useEffect(() => {
    const checkModuleData = async () => {
      if (!moduleId) {
        console.log('🔍 No moduleId detected, resetting state')
        setCheckedPdf(true)
        setHasPdf(false)
        setExistingSlides(0)
        return
      }

      console.log('🔍 Checking module data for ID:', moduleId)

      // Reset state before checking
      setCheckedPdf(false)
      setHasPdf(false)
      setExistingSlides(0)

      try {
        // Add timestamp to prevent caching issues
        const timestamp = Date.now()
        const url = `/api/modules/${moduleId}?depth=1&t=${timestamp}`
        console.log('🔍 Fetching from:', url)

        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })

        console.log('🔍 API Response status:', res.status, res.statusText)

        if (res.ok) {
          const doc = await res.json()
          console.log('🔍 Module data received:', {
            id: doc.id,
            hasPdfUpload: !!doc?.pdfUpload,
            pdfUploadType: typeof doc?.pdfUpload,
            pdfUploadValue: doc?.pdfUpload,
            slidesCount: Array.isArray(doc?.slides) ? doc.slides.length : 0,
          })

          const hasPdfFile = !!doc?.pdfUpload
          setHasPdf(hasPdfFile)

          // Count existing slides
          const slideCount = Array.isArray(doc?.slides) ? doc.slides.length : 0
          setExistingSlides(slideCount)

          console.log('🔍 State updated:', { hasPdf: hasPdfFile, existingSlides: slideCount })
        } else {
          console.log('🔍 API request failed:', res.status, res.statusText)
          setHasPdf(false)
          setExistingSlides(0)
        }
      } catch (error) {
        console.error('🔍 Error fetching module data:', error)
        setHasPdf(false)
        setExistingSlides(0)
      } finally {
        setCheckedPdf(true)
        console.log('🔍 Check complete')
      }
    }

    checkModuleData()
  }, [moduleId, currentUrl]) // Also depend on currentUrl to refetch when navigation changes

  const handleProcessPdf = async (forceReplace = false) => {
    if (!moduleId) {
      setMessage('❌ Please save the module first')
      return
    }

    // If there are existing slides and user hasn't confirmed replacement
    if (existingSlides > 0 && !forceReplace) {
      setShowConfirmation(true)
      return
    }

    setIsProcessing(true)
    setShowConfirmation(false)

    if (existingSlides > 0) {
      setMessage('🗑️ Cleaning up existing slides and media... This may take a moment.')
    } else {
      setMessage(
        '🚀 Processing PDF... This may take a few moments. The page will automatically refresh when complete.',
      )
    }

    try {
      const timeoutMs = 55000
      const startPage = nextStartPageRef.current || 1

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
            batchSize: 1,
          },
          startPage,
          replaceExisting: existingSlides > 0, // Tell server to clean up existing slides
        }),
      })

      let result: any = {}
      try {
        result = await response.json()
      } catch {
        result = { success: false, error: 'Empty response from server' }
      }

      if (response.ok && result.success) {
        const successMessage =
          existingSlides > 0
            ? `🎉 Successfully replaced ${existingSlides} old slides with ${result.slidesCreated || 0} new slides from ${result.totalPages || 0} pages!`
            : `🎉 Successfully created ${result.slidesCreated || 0} slides from ${result.totalPages || 0} pages!`
        setMessage(successMessage)

        // Check if there are more pages to process
        const currentStartPage = nextStartPageRef.current || 1
        if (result.nextStartPage && result.nextStartPage > currentStartPage) {
          setMessage(
            `📄 Processing continues... Created ${result.slidesCreated || 0} slides so far. Page will refresh when all pages are complete.`,
          )
          setNextStartPage(result.nextStartPage)
          setTimeout(() => {
            handleProcessPdf(true) // Skip confirmation on continuation
          }, 1000)
        } else {
          // All done - refresh the page
          setMessage(
            `✅ Processing complete! Created ${result.slidesCreated || 0} slides. Refreshing page...`,
          )
          setNextStartPage(1) // Reset for next run
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      } else {
        const statusText = `${response.status} ${response.statusText || ''}`.trim()
        const errorMsg =
          result.error ||
          result.errors?.[0] ||
          (response.ok ? 'Processing failed' : statusText || 'Network/timeout')
        setMessage(`❌ Error: ${errorMsg}`)
        setIsProcessing(false)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessage(`❌ Network error: ${errorMsg}`)
      setIsProcessing(false)
      console.error('❌ Network error:', error)
    }
  }

  // Show different states based on PDF availability
  if (!checkedPdf) {
    return (
      <div
        style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #007bff',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
            Checking for PDF upload...
          </p>
        </div>
      </div>
    )
  }

  if (!hasPdf) {
    // Check if we're not on a module page (e.g., on a course page)
    const isNotOnModulePage =
      !moduleId && currentUrl.includes('/admin/collections/') && !currentUrl.includes('/modules/')

    if (isNotOnModulePage) {
      // Try to extract module info from props to create a direct link
      const getModuleLink = () => {
        if (props && typeof props === 'object') {
          const propsObj = props as any

          console.log('🔗 Attempting to extract module link from props:', {
            propsKeys: Object.keys(propsObj),
            value: propsObj.value,
            initialValue: propsObj.initialValue,
            data: propsObj.data,
            docID: propsObj.docID,
            id: propsObj.id,
          })

          // Method 1: Look for module reference in various prop structures
          const moduleRef = propsObj.value || propsObj.initialValue || propsObj.data
          if (moduleRef && typeof moduleRef === 'object' && moduleRef.id) {
            console.log('🔗 Found module ID in object:', moduleRef.id)
            return `/admin/collections/modules/${moduleRef.id}`
          }
          if (typeof moduleRef === 'string' && moduleRef.match(/^\d+$/)) {
            console.log('🔗 Found module ID as string:', moduleRef)
            return `/admin/collections/modules/${moduleRef}`
          }

          // Method 2: Check if props directly contain module ID
          if (propsObj.docID && propsObj.docID.match(/^\d+$/)) {
            console.log('🔗 Found module ID in docID:', propsObj.docID)
            return `/admin/collections/modules/${propsObj.docID}`
          }
          if (propsObj.id && propsObj.id.match(/^\d+$/)) {
            console.log('🔗 Found module ID in id:', propsObj.id)
            return `/admin/collections/modules/${propsObj.id}`
          }

          // Method 3: Try to extract from current URL context (e.g., if we're in a nested view)
          if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            const moduleParam = urlParams.get('module') || urlParams.get('moduleId')
            if (moduleParam && moduleParam.match(/^\d+$/)) {
              console.log('🔗 Found module ID in URL params:', moduleParam)
              return `/admin/collections/modules/${moduleParam}`
            }
          }

          // Method 4: Try to extract from breadcrumb or navigation context
          if (typeof window !== 'undefined') {
            // Look for module ID in the page content or breadcrumbs
            const breadcrumbLinks = document.querySelectorAll('a[href*="/modules/"]')
            for (const link of breadcrumbLinks) {
              const href = link.getAttribute('href')
              if (href) {
                const match = href.match(/\/modules\/(\d+)/)
                if (match?.[1]) {
                  console.log('🔗 Found module ID in breadcrumb:', match[1])
                  return `/admin/collections/modules/${match[1]}`
                }
              }
            }

            // Look for module ID in any data attributes or hidden inputs
            const moduleInputs = document.querySelectorAll(
              '[data-module-id], [name*="module"], input[value*="module"]',
            )
            for (const input of moduleInputs) {
              const moduleId =
                input.getAttribute('data-module-id') ||
                input.getAttribute('value') ||
                (input as HTMLInputElement).value
              if (moduleId && moduleId.match(/^\d+$/)) {
                console.log('🔗 Found module ID in DOM element:', moduleId)
                return `/admin/collections/modules/${moduleId}`
              }
            }
          }

          // Method 5: Try to extract from the field path or context
          if (path && typeof path === 'string') {
            // Sometimes the path contains module reference
            const pathMatch = path.match(/modules?[.\[\]]*(\d+)/)
            if (pathMatch?.[1]) {
              console.log('🔗 Found module ID in field path:', pathMatch[1])
              return `/admin/collections/modules/${pathMatch[1]}`
            }
          }
        }

        // Method 6: Last resort - try to find ANY module ID in the current page
        if (typeof window !== 'undefined') {
          // Look for any text that looks like a module ID in the page
          const pageText = document.body.innerText || ''
          const idMatches = pageText.match(/(?:module|id)[\s:]*(\d+)/gi)
          if (idMatches && idMatches.length > 0) {
            // Try to extract the most likely module ID
            for (const match of idMatches) {
              const idMatch = match.match(/(\d+)/)
              if (idMatch?.[1] && idMatch[1].length <= 4) {
                // Reasonable ID length
                console.log('🔗 Found potential module ID in page text:', idMatch[1])
                return `/admin/collections/modules/${idMatch[1]}`
              }
            }
          }

          // Check if there's an ID in the page title or heading
          const title = document.title
          const titleMatch = title.match(/(\d+)/)
          if (titleMatch?.[1]) {
            console.log('🔗 Found potential module ID in page title:', titleMatch[1])
            return `/admin/collections/modules/${titleMatch[1]}`
          }
        }

        console.log('🔗 No module link could be determined')
        return null
      }

      const moduleLink = getModuleLink()

      return (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '8px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p
              style={{ margin: '0 0 8px 0', color: '#0066cc', fontSize: '14px', fontWeight: '500' }}
            >
              📄 PDF Processor Available
            </p>
            <p
              style={{
                margin: '0 0 12px 0',
                color: '#0066cc',
                fontSize: '13px',
                lineHeight: '1.4',
              }}
            >
              The PDF processor works best when viewing the module directly.
            </p>
            {moduleLink ? (
              <div>
                <a
                  href={moduleLink}
                  style={{
                    display: 'inline-block',
                    padding: '12px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,123,255,0.2)',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#0056b3'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.3)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#007bff'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.2)'
                  }}
                  onClick={() => console.log('🔗 Navigating to module:', moduleLink)}
                >
                  🔗 Open Module to Process PDF
                </a>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '11px' }}>
                  Click to open the module page where PDF processing is available
                </p>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    margin: '0 0 8px 0',
                    color: '#666',
                    fontSize: '12px',
                    fontStyle: 'italic',
                  }}
                >
                  Could not auto-detect the module. Please navigate to the specific module page.
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <a
                    href="/admin/collections/modules"
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                  >
                    📋 Browse Modules
                  </a>
                  <button
                    onClick={() => {
                      // Try to refresh and re-detect
                      console.log('🔄 Attempting to re-detect module context')
                      window.location.reload()
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Refresh & Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    // Regular "no PDF" message for when we're on a module page but no PDF is uploaded
    return (
      <div
        style={{
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', color: '#856404', fontSize: '14px', fontWeight: '500' }}>
            No PDF uploaded
          </p>
          <p style={{ margin: '0 0 10px 0', color: '#856404', fontSize: '12px' }}>
            Upload a PDF file above, save the module, then use the refresh button (🔄) to enable
            processing
          </p>
          <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '8px' }}>
            Debug: Module ID = {moduleId || 'not detected'} | URL = {currentUrl}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div
        style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
        }}
      >
        <div style={{ marginBottom: '15px' }}>
          <h4
            style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '600', color: '#495057' }}
          >
            PDF Processor
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6c757d', lineHeight: '1.4' }}>
              Convert your PDF into individual slides with automated text extraction and image
              generation
            </p>
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered')
                setCheckedPdf(false)
                // Force re-check by updating a dependency
                setCurrentUrl(
                  window.location.pathname + window.location.search + '#refresh-' + Date.now(),
                )
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                marginLeft: '10px',
              }}
              title="Refresh PDF detection"
            >
              🔄
            </button>
          </div>

          {/* Show existing slides info */}
          {existingSlides > 0 && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
              }}
            >
              <p style={{ margin: 0, fontSize: '13px', color: '#495057', fontWeight: '500' }}>
                Current slides: {existingSlides}
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div
            style={{
              marginBottom: '15px',
              padding: '15px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <h5
                style={{
                  margin: '0 0 5px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#856404',
                }}
              >
                Replace Existing Slides?
              </h5>
              <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                This will delete all {existingSlides} existing slide
                {existingSlides !== 1 ? 's' : ''} and their associated media files, then create new
                slides from the PDF. This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleProcessPdf(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Yes, Replace All Slides
              </button>
              <button
                onClick={() => setShowConfirmation(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => handleProcessPdf()}
          disabled={isProcessing || showConfirmation}
          style={{
            padding: '14px 20px',
            backgroundColor:
              isProcessing || showConfirmation
                ? '#6c757d'
                : existingSlides > 0
                  ? '#fd7e14'
                  : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isProcessing || showConfirmation ? 'not-allowed' : 'pointer',
            margin: 0,
            transition: 'all 0.2s ease',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isProcessing ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Processing...
            </>
          ) : (
            <>{existingSlides > 0 ? 'Reprocess PDF (Replace Slides)' : 'Process PDF into Slides'}</>
          )}
        </button>

        {message && (
          <div
            style={{
              marginTop: '15px',
              padding: '12px',
              backgroundColor: message.includes('❌') ? '#f8d7da' : '#d4edda',
              border: `1px solid ${message.includes('❌') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '6px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: message.includes('❌') ? '#721c24' : '#155724',
                fontWeight: '500',
              }}
            >
              {message}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default PdfProcessorField
