'use client'

import React, { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

interface PDFImageConverterProps {
  pdfUrl: string
  slideId: string | number
  onImageGenerated?: (imageBlob: Blob, slideId: string | number) => void
  autoProcess?: boolean
}

export const PDFImageConverter: React.FC<PDFImageConverterProps> = ({
  pdfUrl,
  slideId,
  onImageGenerated,
  autoProcess = false,
}) => {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (autoProcess && pdfUrl) {
      convertPDFToImage()
    }
  }, [pdfUrl, autoProcess])

  const convertPDFToImage = async () => {
    if (!pdfUrl) return
    
    setProcessing(true)
    setError(null)
    
    try {
      console.log(`🔄 Converting PDF to image for slide ${slideId}`)
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument(pdfUrl)
      const pdf: PDFDocumentProxy = await loadingTask.promise
      
      // Get the first page (since this should be a single-page PDF)
      const page: PDFPageProxy = await pdf.getPage(1)
      
      // Set up canvas with proper dimensions
      const viewport = page.getViewport({ scale: 2.0 }) // Higher scale for better quality
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Could not get canvas context')
      }
      
      canvas.width = viewport.width
      canvas.height = viewport.height
      
      // Render the PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      }
      
      await page.render(renderContext).promise
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert canvas to blob'))
          }
        }, 'image/png', 0.95)
      })
      
      // Create object URL for preview
      const url = URL.createObjectURL(blob)
      setImageUrl(url)
      
      // Notify parent component
      if (onImageGenerated) {
        onImageGenerated(blob, slideId)
      }
      
      console.log(`✅ Successfully converted PDF to image for slide ${slideId}`)
      
    } catch (err) {
      console.error(`❌ Error converting PDF to image:`, err)
      setError(err instanceof Error ? err.message : 'Failed to convert PDF')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="pdf-image-converter">
      {!autoProcess && (
        <button
          onClick={convertPDFToImage}
          disabled={processing || !pdfUrl}
          className="convert-button"
        >
          {processing ? 'Converting...' : 'Convert to Image'}
        </button>
      )}
      
      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}
      
      {imageUrl && (
        <div className="image-preview">
          <img src={imageUrl} alt={`Slide ${slideId}`} />
        </div>
      )}
      
      {processing && (
        <div className="processing-indicator">
          Converting PDF page to image...
        </div>
      )}
    </div>
  )
}

export default PDFImageConverter