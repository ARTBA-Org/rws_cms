import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';

async function triggerPdfProcessing() {
  try {
    console.log('🔄 Triggering PDF processing for module 73...');
    
    // Update the module to trigger the afterChange hook
    const response = await fetch(`${API_URL}/modules/73`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Just update the description to trigger the hook
        description: 'Test module for PDF processing - updated to trigger processing',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update module: ${error}`);
    }
    
    const result = await response.json();
    console.log('✅ Module updated, PDF processing triggered');
    console.log('Module ID:', result.doc.id);
    console.log('PDF Upload ID:', result.doc.pdfUpload);
    
    // Wait for processing to complete
    console.log('\n⏳ Waiting for PDF processing to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check the module for generated slides
    console.log('\n🔍 Checking module for generated slides...');
    const checkResponse = await fetch(`${API_URL}/modules/73?depth=2`);
    
    if (!checkResponse.ok) {
      const error = await checkResponse.text();
      throw new Error(`Failed to fetch module: ${error}`);
    }
    
    const updatedModule = await checkResponse.json();
    
    console.log('\n📊 Results:');
    console.log('─'.repeat(50));
    console.log(`Module Title: ${updatedModule.title}`);
    console.log(`Number of Slides: ${updatedModule.slides?.length || 0}`);
    
    if (updatedModule.slides && updatedModule.slides.length > 0) {
      console.log('\n📑 Generated Slides:');
      updatedModule.slides.forEach((slide, index) => {
        const slideData = typeof slide === 'object' ? slide : { id: slide };
        console.log(`  ${index + 1}. Slide ID: ${slideData.id}`);
        if (slideData.title) console.log(`     Title: ${slideData.title}`);
        if (slideData.description) console.log(`     Description: ${slideData.description}`);
        if (slideData.image) {
          const imageInfo = typeof slideData.image === 'object' ? slideData.image : { id: slideData.image };
          if (imageInfo.url) {
            console.log(`     Image URL: ${imageInfo.url}`);
            if (imageInfo.url.includes('supabase')) {
              console.log(`     ✅ Stored in Supabase Storage`);
            }
          }
        }
      });
    } else {
      console.log('\n⚠️ No slides found. Check the server logs for processing errors.');
    }
    
    console.log('\n📌 Check server logs to see processing details');
    console.log('📌 Admin Panel: http://localhost:3001/admin/collections/modules/73');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Run the trigger
triggerPdfProcessing();