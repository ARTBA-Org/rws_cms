import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://localhost:3001/api';

async function testPdfUpload() {
  try {
    console.log('🚀 Starting PDF upload test via API...');
    console.log('📁 Using sample PDF: sample-local-pdf.pdf');
    
    // Read the sample PDF file
    const pdfPath = path.join(process.cwd(), 'sample-local-pdf.pdf');
    console.log('📄 Reading PDF from:', pdfPath);
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at: ${pdfPath}`);
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`✅ PDF loaded: ${pdfBuffer.length} bytes`);
    
    // Step 1: Upload PDF to Pdfs collection
    console.log('\n📤 Uploading PDF to Pdfs collection...');
    const formData = new FormData();
    formData.append('file', pdfBuffer, {
      filename: 'sample-local-pdf.pdf',
      contentType: 'application/pdf',
    });
    formData.append('title', 'Test PDF Upload');
    
    const pdfUploadResponse = await fetch(`${API_URL}/pdfs`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });
    
    if (!pdfUploadResponse.ok) {
      const error = await pdfUploadResponse.text();
      throw new Error(`Failed to upload PDF: ${error}`);
    }
    
    const pdfDoc = await pdfUploadResponse.json();
    console.log(`✅ PDF uploaded with ID: ${pdfDoc.doc.id}`);
    console.log(`📍 PDF URL: ${pdfDoc.doc.url}`);
    
    // Step 2: Create a module with the PDF
    console.log('\n📝 Creating test module with PDF...');
    const moduleResponse = await fetch(`${API_URL}/modules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Test Module - PDF Processing',
        description: 'This module tests automatic PDF to slides conversion',
        pdfUpload: pdfDoc.doc.id,
      }),
    });
    
    if (!moduleResponse.ok) {
      const error = await moduleResponse.text();
      throw new Error(`Failed to create module: ${error}`);
    }
    
    const module = await moduleResponse.json();
    console.log(`✅ Module created with ID: ${module.doc.id}`);
    
    // Step 3: Wait for processing
    console.log('\n⏳ Waiting for PDF processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    
    // Step 4: Check the module for generated slides
    console.log('\n🔍 Checking module for generated slides...');
    const moduleCheckResponse = await fetch(`${API_URL}/modules/${module.doc.id}?depth=2`);
    
    if (!moduleCheckResponse.ok) {
      const error = await moduleCheckResponse.text();
      throw new Error(`Failed to fetch module: ${error}`);
    }
    
    const updatedModule = await moduleCheckResponse.json();
    
    console.log('\n📊 Results:');
    console.log('─'.repeat(50));
    console.log(`Module Title: ${updatedModule.title}`);
    console.log(`Module ID: ${updatedModule.id}`);
    console.log(`PDF Upload ID: ${updatedModule.pdfUpload}`);
    console.log(`Number of Slides: ${updatedModule.slides?.length || 0}`);
    
    if (updatedModule.slides && updatedModule.slides.length > 0) {
      console.log('\n📑 Generated Slides:');
      updatedModule.slides.forEach((slide, index) => {
        const slideData = typeof slide === 'object' ? slide : { id: slide };
        console.log(`  ${index + 1}. Slide ID: ${slideData.id}`);
        if (slideData.title) console.log(`     Title: ${slideData.title}`);
        if (slideData.image) {
          const imageId = typeof slideData.image === 'object' ? slideData.image.id : slideData.image;
          console.log(`     Image ID: ${imageId}`);
          if (typeof slideData.image === 'object' && slideData.image.url) {
            console.log(`     Image URL: ${slideData.image.url}`);
            if (slideData.image.url.includes('supabase')) {
              console.log(`     ✅ Stored in Supabase Storage`);
            }
          }
        }
      });
    }
    
    // Step 5: Check PdfPages
    console.log('\n📄 Checking PdfPages collection...');
    const pdfPagesResponse = await fetch(`${API_URL}/pdf-pages?where[module][equals]=${module.doc.id}&depth=1`);
    
    if (pdfPagesResponse.ok) {
      const pdfPages = await pdfPagesResponse.json();
      console.log(`Found ${pdfPages.docs.length} PDF pages`);
      if (pdfPages.docs.length > 0) {
        console.log('\n📖 PDF Pages:');
        pdfPages.docs.forEach((page) => {
          console.log(`  Page ${page.pageNumber}: ${page.title}`);
          const mediaId = typeof page.media === 'object' ? page.media.id : page.media;
          console.log(`    Media ID: ${mediaId}`);
          if (typeof page.media === 'object' && page.media.url) {
            console.log(`    Media URL: ${page.media.url}`);
          }
        });
      }
    }
    
    console.log('\n✨ Test completed successfully!');
    console.log('─'.repeat(50));
    console.log('Summary:');
    console.log(`  • PDF uploaded: ✅`);
    console.log(`  • Module created: ✅`);
    console.log(`  • Slides generated: ${updatedModule.slides?.length > 0 ? '✅' : '❌'} (${updatedModule.slides?.length || 0} slides)`);
    console.log(`  • Expected 3 slides for 3-page PDF`);
    
    console.log('\n🧹 Test data created:');
    console.log(`  Module ID: ${module.doc.id}`);
    console.log(`  PDF ID: ${pdfDoc.doc.id}`);
    console.log('  (You can delete these from the admin panel if needed)');
    
    console.log('\n📌 Admin Panel: http://localhost:3001/admin');
    console.log(`  View Module: http://localhost:3001/admin/collections/modules/${module.doc.id}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
console.log('⚠️  Make sure the dev server is running on http://localhost:3001');
console.log('   Run: npm run dev\n');

setTimeout(() => {
  testPdfUpload();
}, 2000);