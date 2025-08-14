#!/usr/bin/env node

/**
 * Local PDF Processing Test Script
 * Run with: node test-pdf-local.js
 * 
 * This script tests PDF processing locally without deploying to AWS
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { PDFProcessorOptimized } from './src/utils/pdfProcessorOptimized.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Payload for local testing
const mockPayload = {
  create: async ({ collection, data, file }) => {
    console.log(`[MOCK] Creating ${collection}:`, {
      ...data,
      file: file ? `${file.name} (${file.size} bytes)` : undefined
    });
    
    // Simulate creating media
    if (collection === 'media' && file) {
      const mediaId = Math.floor(Math.random() * 10000);
      console.log(`[MOCK] Media uploaded with ID: ${mediaId}`);
      return { id: mediaId };
    }
    
    // Simulate creating slide
    if (collection === 'slides') {
      const slideId = Math.floor(Math.random() * 10000);
      console.log(`[MOCK] Slide created with ID: ${slideId}`);
      return { id: slideId };
    }
    
    return { id: Math.floor(Math.random() * 10000) };
  },
  
  findByID: async ({ collection, id }) => {
    console.log(`[MOCK] Finding ${collection} by ID: ${id}`);
    
    if (collection === 'modules') {
      return {
        id,
        title: 'Test Module',
        slides: []
      };
    }
    
    return { id };
  },
  
  update: async ({ collection, id, data }) => {
    console.log(`[MOCK] Updating ${collection} ${id}:`, data);
    return { id, ...data };
  }
};

// Mock getPayload
global.mockGetPayload = async () => mockPayload;

async function testPDFProcessing() {
  console.log('🚀 Starting Local PDF Processing Test\n');
  console.log('=' .repeat(60));
  
  try {
    // Test configurations
    const configs = [
      {
        name: 'Fast (Text Only)',
        config: {
          maxPages: 5,
          timeoutMs: 60000,
          enableImages: false,
          batchSize: 1
        }
      },
      {
        name: 'Standard (With Images)',
        config: {
          maxPages: 3,
          timeoutMs: 30000,
          enableImages: true,
          batchSize: 1
        }
      },
      {
        name: 'Full (All Pages)',
        config: {
          maxPages: 10,
          timeoutMs: 60000,
          enableImages: true,
          batchSize: 2
        }
      }
    ];
    
    // Load test PDF
    const pdfPath = join(__dirname, 'test-files', 'sample.pdf');
    let pdfBuffer;
    
    try {
      pdfBuffer = await fs.readFile(pdfPath);
      console.log(`✅ Loaded PDF: ${pdfPath} (${pdfBuffer.length} bytes)\n`);
    } catch (error) {
      console.log('⚠️  No test PDF found. Creating a simple test PDF...\n');
      
      // Use any PDF from media folder if available
      const mediaPath = join(__dirname, 'media');
      try {
        const files = await fs.readdir(mediaPath);
        const pdfFile = files.find(f => f.endsWith('.pdf'));
        if (pdfFile) {
          pdfBuffer = await fs.readFile(join(mediaPath, pdfFile));
          console.log(`✅ Using PDF from media: ${pdfFile}\n`);
        }
      } catch (e) {
        console.log('❌ No PDF files found. Please add a test PDF to test-files/sample.pdf\n');
        return;
      }
    }
    
    // Test each configuration
    for (const testConfig of configs) {
      console.log('=' .repeat(60));
      console.log(`\n🧪 Testing: ${testConfig.name}`);
      console.log('Configuration:', JSON.stringify(testConfig.config, null, 2));
      console.log();
      
      const processor = new PDFProcessorOptimized(testConfig.config);
      
      // Mock the getPayload import
      const originalGetPayload = processor.processPDFToSlides.toString();
      if (originalGetPayload.includes('getPayload')) {
        // Override for testing
        processor.getPayload = global.mockGetPayload;
      }
      
      const startTime = Date.now();
      
      try {
        const result = await processor.processPDFToSlides(
          pdfBuffer,
          'test-module-123',
          'test.pdf'
        );
        
        const elapsed = Date.now() - startTime;
        
        console.log('\n📊 Results:');
        console.log(`  ✓ Success: ${result.success}`);
        console.log(`  ✓ Slides Created: ${result.slidesCreated}`);
        console.log(`  ✓ Pages Processed: ${result.pagesProcessed}/${result.totalPages}`);
        console.log(`  ✓ Text Extracted: ${result.textExtracted}`);
        console.log(`  ✓ Images Generated: ${result.imagesGenerated}`);
        console.log(`  ✓ Time Elapsed: ${elapsed}ms`);
        
        if (result.partialSuccess) {
          console.log(`  ⚠️  Partial Success - Some pages not processed`);
        }
        
        if (result.errors && result.errors.length > 0) {
          console.log(`  ❌ Errors:`, result.errors);
        }
      } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`\n❌ Test failed after ${elapsed}ms:`, error.message);
      }
      
      console.log();
    }
    
    console.log('=' .repeat(60));
    console.log('\n✅ Local testing complete!');
    console.log('\nTo test with your own PDF:');
    console.log('1. Create folder: mkdir test-files');
    console.log('2. Add your PDF: cp your-file.pdf test-files/sample.pdf');
    console.log('3. Run again: node test-pdf-local.js');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPDFProcessing().catch(console.error);