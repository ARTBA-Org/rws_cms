import { defineFunction } from '@aws-amplify/backend';

export const pdfProcessor = defineFunction({
  name: 'pdfProcessor',
  entry: './handler.ts',
  timeoutSeconds: 60, // Increase timeout to 60 seconds
  memoryMB: 1024, // Increase memory to 1024 MB
  environment: {
    PROCESSOR_TIMEOUT_MS: '55000', // 55 seconds for processor (5s buffer)
    MAX_PAGES: '8', // Can process more pages with 60s timeout
    ENABLE_IMAGES: 'true',
    BATCH_SIZE: '1'
  }
});