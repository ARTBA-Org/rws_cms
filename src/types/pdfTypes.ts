import type { Module, Slide, Media } from '../payload-types'

// PDF Processing Types
export interface PDFProcessConfig {
  maxPages?: number;
  timeoutMs?: number;
  enableImages?: boolean;
  batchSize?: number;
  startPage?: number;
}

export interface PDFProcessResult {
  success: boolean;
  slidesCreated: number;
  errors?: string[];
  warnings?: string[];
  slideIds?: Array<number | string>;
  moduleUpdated?: boolean;
  textExtracted?: boolean;
  imagesGenerated?: boolean;
  totalPages?: number;
  pagesProcessed?: number;
  partialSuccess?: boolean;
  timeElapsed?: number;
  startPage?: number;
  nextStartPage?: number | null;
}

// Slide Creation Types
export interface SlideCreateData {
  title: string;
  description?: string;
  type: SlideType;
  urls: SlideUrl[];
  source?: SlideSource;
  image?: number;
}

export interface SlideSource {
  pdfFilename: string;
  pdfPage: number;
  module: number;
}

export interface SlideUrl {
  url?: string;
  id?: string;
}

export type SlideType = 'regular' | 'video' | 'quiz' | 'reference' | 'resources';

// Module with populated fields
export interface PopulatedModule extends Omit<Module, 'slides' | 'pdfUpload'> {
  slides?: Slide[] | null;
  pdfUpload?: Media | null;
}

// Slide with populated fields
export interface PopulatedSlide extends Omit<Slide, 'source' | 'image'> {
  source?: {
    pdfFilename?: string | null;
    pdfPage?: number | null;
    module?: Module | null;
  };
  image?: Media | null;
}

// PDF Text Extraction Types
export interface PDFTextResult {
  text: string;
  numpages: number;
  info: any;
  metadata: any;
}

// Image Generation Types
export interface ImageGenerationOptions {
  dpi?: number;
  maxDimension?: number;
  format?: 'png' | 'webp';
  quality?: number;
}

export interface ImageGenerationResult {
  buffer: Buffer;
  mediaId: number;
  filename: string;
  size: number;
}

// Cache Types
export interface CacheKey {
  moduleId: string;
  pdfFilename: string;
  pageNum: number;
}

export interface CachedSlideData {
  slideId: number;
  title: string;
  description: string;
  type: SlideType;
  imageGenerated: boolean;
  cached: true;
  cacheTimestamp: number;
}

// Error Types
export class PDFProcessingError extends Error {
  constructor(
    message: string,
    public code: 'PDF_LOAD_FAILED' | 'IMAGE_GENERATION_FAILED' | 'AI_ANALYSIS_FAILED' | 'SLIDE_CREATION_FAILED' | 'MODULE_UPDATE_FAILED',
    public pageNumber?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PDFProcessingError';
  }
}

// Processing Status Types
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export interface ProcessingProgress {
  status: ProcessingStatus;
  totalPages: number;
  processedPages: number;
  createdSlides: number;
  currentPage?: number;
  startTime: number;
  estimatedTimeRemaining?: number;
  errors?: string[];
  warnings?: string[];
}