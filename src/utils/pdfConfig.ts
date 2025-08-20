export interface PDFProcessingConfig {
  // Processing limits
  maxPages: number;
  timeoutMs: number;
  batchSize: number;
  
  // Image generation
  enableImages: boolean;
  imageFormat: 'png' | 'webp';
  imageQuality: number;
  imageDPI: number;
  maxImageDimension: number;
  
  // AI analysis
  enableAI: boolean;
  openaiModel: string;
  aiRetryAttempts: number;
  
  // Browser settings
  puppeteerRetryAttempts: number;
  chromeHeadless: boolean;
  
  // Redis caching
  enableCaching: boolean;
  cacheExpireHours: number;
  
  // Streaming processing
  enableStreaming: boolean;
  streamChunkSize: number;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function getPDFProcessingConfig(): PDFProcessingConfig {
  return {
    // Processing limits
    maxPages: getEnvNumber('PDF_MAX_PAGES', 10),
    timeoutMs: getEnvNumber('PDF_TIMEOUT_MS', 25000),
    batchSize: getEnvNumber('PDF_BATCH_SIZE', 1),
    
    // Image generation
    enableImages: getEnvBoolean('PDF_ENABLE_IMAGES', true),
    imageFormat: (process.env.PDF_IMAGE_FORMAT as 'png' | 'webp') || 'png',
    imageQuality: getEnvNumber('PDF_IMAGE_QUALITY', 90),
    imageDPI: getEnvNumber('PDF_IMAGE_DPI', 300),
    maxImageDimension: getEnvNumber('PDF_MAX_IMAGE_DIMENSION', 6000),
    
    // AI analysis
    enableAI: getEnvBoolean('PDF_ENABLE_AI', !!process.env.OPENAI_API_KEY),
    openaiModel: process.env.OPENAI_MODEL || 'gpt-5-nano',
    aiRetryAttempts: getEnvNumber('PDF_AI_RETRY_ATTEMPTS', 3),
    
    // Browser settings
    puppeteerRetryAttempts: getEnvNumber('PDF_PUPPETEER_RETRY_ATTEMPTS', 2),
    chromeHeadless: getEnvBoolean('CHROME_HEADLESS', true),
    
    // Redis caching
    enableCaching: getEnvBoolean('PDF_ENABLE_CACHING', false),
    cacheExpireHours: getEnvNumber('PDF_CACHE_EXPIRE_HOURS', 24),
    
    // Streaming processing
    enableStreaming: getEnvBoolean('PDF_ENABLE_STREAMING', true),
    streamChunkSize: getEnvNumber('PDF_STREAM_CHUNK_SIZE', 2),
  };
}

export const PDF_CONFIG = getPDFProcessingConfig();