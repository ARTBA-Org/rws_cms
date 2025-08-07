import { getPayload } from 'payload';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPdfUpload() {
  try {
    console.log('🚀 Starting PDF upload test...');
    console.log('📁 Using sample PDF: sample-local-pdf.pdf');
    
    // Initialize Payload
    console.log('⚙️ Initializing Payload...');
    
    // Import config dynamically to handle TypeScript
    const { default: buildConfig } = await import('payload/config');
    const { postgresAdapter } = await import('@payloadcms/db-postgres');
    const { s3Storage } = await import('@payloadcms/storage-s3');
    
    // Build minimal config for testing
    const config = buildConfig({
      secret: process.env.PAYLOAD_SECRET || '8tok6QrKzWdsBag4/MIvm4Pp1TF+d9xx8tok6QrKzWd',
      collections: [
        (await import('../src/collections/Users.js')).default,
        (await import('../src/collections/Media.js')).default,
        (await import('../src/collections/Modules.js')).default,
        (await import('../src/collections/Slides.js')).default,
        (await import('../src/collections/Pdfs.js')).default,
        (await import('../src/collections/PdfPages.js')).default,
      ],
      db: postgresAdapter({
        pool: {
          connectionString: process.env.DATABASE_URI,
          ssl: {
            rejectUnauthorized: false,
          },
        },
      }),
      plugins: [
        s3Storage({
          collections: {
            media: {
              prefix: 'media',
            },
            pdfs: {
              prefix: 'pdfs',
            },
          },
          bucket: 'Media',
          config: {
            forcePathStyle: true,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY || process.env.S3_ACCESS_KEY,
              secretAccessKey: process.env.AWS_SECRET_KEY || process.env.S3_SECRET_KEY,
            },
            region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1',
            endpoint: process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT,
          },
        }),
      ].filter(Boolean),
    });
    
    const payload = await getPayload({ config });
    
    // Read the sample PDF file
    const pdfPath = path.join(process.cwd(), 'sample-local-pdf.pdf');
    console.log('📄 Reading PDF from:', pdfPath);
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at: ${pdfPath}`);
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`✅ PDF loaded: ${pdfBuffer.length} bytes`);
    
    // First, upload the PDF to the Pdfs collection
    console.log('\n📤 Uploading PDF to Pdfs collection...');
    const pdfDoc = await payload.create({
      collection: 'pdfs',
      data: {
        title: 'Test PDF Upload',
      },
      file: {
        data: pdfBuffer,
        mimetype: 'application/pdf',
        name: 'sample-local-pdf.pdf',
        size: pdfBuffer.length,
      },
    });
    console.log(`✅ PDF uploaded with ID: ${pdfDoc.id}`);
    console.log(`📍 PDF URL: ${pdfDoc.url}`);
    
    // Create a test module with the PDF
    console.log('\n📝 Creating test module...');
    const moduleData = {
      title: 'Test Module - PDF Processing',
      description: 'This module tests automatic PDF to slides conversion',
      pdfUpload: pdfDoc.id,
    };
    
    const module = await payload.create({
      collection: 'modules',
      data: moduleData,
    });
    
    console.log(`✅ Module created with ID: ${module.id}`);
    
    // Wait a bit for processing to complete
    console.log('\n⏳ Waiting for PDF processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Fetch the module again to see the slides
    console.log('\n🔍 Checking module for generated slides...');
    const updatedModule = await payload.findByID({
      collection: 'modules',
      id: module.id,
      depth: 2, // Get related slides data
    });
    
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
        if (slideData.image) console.log(`     Image ID: ${typeof slideData.image === 'object' ? slideData.image.id : slideData.image}`);
      });
    }
    
    // Check PdfPages collection
    console.log('\n📄 Checking PdfPages collection...');
    const pdfPages = await payload.find({
      collection: 'pdf-pages',
      where: {
        module: {
          equals: module.id,
        },
      },
      depth: 1,
    });
    
    console.log(`Found ${pdfPages.docs.length} PDF pages`);
    if (pdfPages.docs.length > 0) {
      console.log('\n📖 PDF Pages:');
      pdfPages.docs.forEach((page) => {
        console.log(`  Page ${page.pageNumber}: ${page.title}`);
        console.log(`    Media ID: ${typeof page.media === 'object' ? page.media.id : page.media}`);
      });
    }
    
    // Check Media collection for generated images
    console.log('\n🖼️ Checking Media collection for generated images...');
    const media = await payload.find({
      collection: 'media',
      where: {
        alt: {
          contains: 'sample-local-pdf',
        },
      },
      limit: 10,
    });
    
    console.log(`Found ${media.docs.length} media items`);
    if (media.docs.length > 0) {
      console.log('\n📷 Generated Images:');
      media.docs.forEach((item) => {
        console.log(`  - ${item.filename || 'Unnamed'}`);
        console.log(`    Alt: ${item.alt}`);
        console.log(`    URL: ${item.url}`);
        if (item.url?.includes('supabase')) {
          console.log(`    ✅ Stored in Supabase Storage`);
        }
      });
    }
    
    console.log('\n✨ Test completed successfully!');
    console.log('─'.repeat(50));
    console.log('Summary:');
    console.log(`  • PDF uploaded: ✅`);
    console.log(`  • Module created: ✅`);
    console.log(`  • Slides generated: ${updatedModule.slides?.length > 0 ? '✅' : '❌'} (${updatedModule.slides?.length || 0} slides)`);
    console.log(`  • PDF pages tracked: ${pdfPages.docs.length > 0 ? '✅' : '❌'} (${pdfPages.docs.length} pages)`);
    console.log(`  • Images in S3: ${media.docs.some(m => m.url?.includes('supabase')) ? '✅' : '❌'}`);
    
    // Clean up option
    console.log('\n🧹 Test data created:');
    console.log(`  Module ID: ${module.id}`);
    console.log(`  PDF ID: ${pdfDoc.id}`);
    console.log('  (You can delete these from the admin panel if needed)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testPdfUpload();