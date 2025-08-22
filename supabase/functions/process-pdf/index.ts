import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import necessary modules for PDF processing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Types for our PDF processing
interface PDFProcessRequest {
  moduleId: string;
  pdfBuffer?: ArrayBuffer;
  pdfUrl?: string;
  options?: {
    startPage?: number;
    maxPages?: number;
    enableImages?: boolean;
    enableAI?: boolean;
    imageFormat?: 'png' | 'webp';
    imageQuality?: number;
  };
}

interface PDFProcessResult {
  success: boolean;
  slidesCreated?: number;
  slideIds?: string[];
  error?: string;
  totalPages?: number;
  pagesProcessed?: number;
  timeElapsed?: number;
}

// Configuration from environment variables
const config = {
  payloadApiUrl: Deno.env.get('PAYLOAD_API_URL') || 'http://localhost:3000',
  openaiApiKey: Deno.env.get('OPENAI_API_KEY'),
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
};

console.log('🚀 PDF Processing Edge Function initialized');

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    console.log('📨 Received PDF processing request');
    const startTime = Date.now();

    // Parse request body
    const body: PDFProcessRequest = await req.json();
    const { moduleId, pdfBuffer, pdfUrl, options = {} } = body;

    if (!moduleId) {
      return new Response(
        JSON.stringify({ error: 'moduleId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📋 Processing PDF for module: ${moduleId}`);
    console.log(`⚙️ Options:`, options);

    // Get PDF buffer from URL if not provided directly
    let pdfData: Uint8Array;
    if (pdfBuffer) {
      pdfData = new Uint8Array(pdfBuffer);
      console.log(`📄 Using provided PDF buffer (${pdfData.length} bytes)`);
    } else if (pdfUrl) {
      console.log(`📄 Fetching PDF from URL: ${pdfUrl}`);
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
      }
      pdfData = new Uint8Array(await pdfResponse.arrayBuffer());
      console.log(`📄 Downloaded PDF (${pdfData.length} bytes)`);
    } else {
      return new Response(
        JSON.stringify({ error: 'Either pdfBuffer or pdfUrl is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create temporary file for PDF processing
    const tempPdfPath = `/tmp/pdf_${moduleId}_${Date.now()}.pdf`;
    await Deno.writeFile(tempPdfPath, pdfData);
    console.log(`💾 Saved PDF to temporary file: ${tempPdfPath}`);

    // Process the PDF using background task for long-running operations
    const processResult = await processPDFInBackground(tempPdfPath, moduleId, options);

    // Clean up temporary file
    try {
      await Deno.remove(tempPdfPath);
      console.log('🗑️ Cleaned up temporary PDF file');
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up temporary file:', cleanupError);
    }

    const timeElapsed = Date.now() - startTime;
    console.log(`⏱️ Total processing time: ${timeElapsed}ms`);

    const result: PDFProcessResult = {
      ...processResult,
      timeElapsed,
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ PDF processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Background processing function
async function processPDFInBackground(
  pdfPath: string, 
  moduleId: string, 
  options: any
): Promise<PDFProcessResult> {
  console.log('🔄 Starting background PDF processing...');
  
  try {
    // Use pdf-lib to get basic PDF info
    const pdfBytes = await Deno.readFile(pdfPath);
    
    // For now, we'll implement a simplified version that focuses on:
    // 1. Text extraction using pdf-parse (if available in Deno)
    // 2. Page-by-page processing
    // 3. Integration with Payload CMS API
    
    const totalPages = await getPDFPageCount(pdfBytes);
    console.log(`📊 PDF has ${totalPages} pages`);
    
    const {
      startPage = 1,
      maxPages = 10,
      enableImages = true,
      enableAI = !!config.openaiApiKey,
    } = options;
    
    const actualStartPage = Math.max(1, Math.min(startPage, totalPages));
    const pagesToProcess = Math.min(maxPages, totalPages - actualStartPage + 1);
    const endPage = actualStartPage + pagesToProcess - 1;
    
    console.log(`🎯 Processing pages ${actualStartPage} to ${endPage}`);
    
    const slideIds: string[] = [];
    let slidesCreated = 0;
    
    // Process pages in batches to avoid timeout
    const batchSize = 2; // Process 2 pages at a time
    for (let page = actualStartPage; page <= endPage; page += batchSize) {
      const batchEnd = Math.min(page + batchSize - 1, endPage);
      console.log(`📦 Processing batch: pages ${page} to ${batchEnd}`);
      
      const batchResults = await processPDFPageBatch(
        pdfBytes, 
        page, 
        batchEnd, 
        moduleId, 
        { enableImages, enableAI }
      );
      
      slideIds.push(...batchResults.slideIds);
      slidesCreated += batchResults.slidesCreated;
      
      // Small delay between batches to prevent overwhelming the system
      if (page + batchSize <= endPage) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Update module with new slides
    if (slideIds.length > 0) {
      console.log(`💾 Updating module ${moduleId} with ${slideIds.length} slides`);
      await updateModuleWithSlides(moduleId, slideIds);
    }
    
    return {
      success: true,
      slidesCreated,
      slideIds,
      totalPages,
      pagesProcessed: pagesToProcess,
    };
    
  } catch (error) {
    console.error('❌ Background processing error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper function to get PDF page count
async function getPDFPageCount(pdfBytes: Uint8Array): Promise<number> {
  try {
    // Try to use a simple PDF parser to get page count
    // For now, we'll return a mock value - in production you'd want to use
    // a proper PDF library that works in Deno
    
    // This is a simplified approach - you might want to use a different library
    // that's compatible with Deno's runtime
    const pdfString = new TextDecoder().decode(pdfBytes.slice(0, 1024));
    const pageMatch = pdfString.match(/\/Count\s+(\d+)/);
    if (pageMatch) {
      return parseInt(pageMatch[1], 10);
    }
    
    // Fallback: estimate based on file size (very rough)
    const estimatedPages = Math.max(1, Math.floor(pdfBytes.length / 50000));
    console.log(`📊 Estimated ${estimatedPages} pages based on file size`);
    return estimatedPages;
    
  } catch (error) {
    console.warn('⚠️ Failed to get PDF page count, defaulting to 1:', error);
    return 1;
  }
}

// Process a batch of PDF pages
async function processPDFPageBatch(
  pdfBytes: Uint8Array,
  startPage: number,
  endPage: number,
  moduleId: string,
  options: { enableImages: boolean; enableAI: boolean }
): Promise<{ slideIds: string[]; slidesCreated: number }> {
  
  const slideIds: string[] = [];
  let slidesCreated = 0;
  
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    console.log(`📄 Processing page ${pageNum}`);
    
    try {
      // Extract text from page (simplified - you'd want a proper PDF text extractor)
      const pageText = await extractTextFromPage(pdfBytes, pageNum);
      
      // Generate image if enabled
      let imageId: string | undefined;
      if (options.enableImages) {
        imageId = await generatePageImage(pdfBytes, pageNum, moduleId);
      }
      
      // Analyze with AI if enabled
      let slideTitle = `Slide ${pageNum}`;
      let slideDescription = pageText.slice(0, 500) || `Content from page ${pageNum}`;
      let slideType = 'regular';
      
      if (options.enableAI && config.openaiApiKey && pageText) {
        const aiAnalysis = await analyzeSlideWithAI(pageText);
        if (aiAnalysis) {
          slideTitle = aiAnalysis.title || slideTitle;
          slideDescription = aiAnalysis.description || slideDescription;
          slideType = aiAnalysis.type || slideType;
        }
      }
      
      // Create slide via Payload API
      const slideId = await createSlideInPayload(moduleId, {
        title: slideTitle,
        description: slideDescription,
        type: slideType,
        image: imageId,
        source: {
          pdfPage: pageNum,
          pdfFilename: `module_${moduleId}.pdf`,
          module: moduleId,
        },
      });
      
      if (slideId) {
        slideIds.push(slideId);
        slidesCreated++;
        console.log(`✅ Created slide ${slideId} for page ${pageNum}`);
      }
      
    } catch (pageError) {
      console.error(`❌ Failed to process page ${pageNum}:`, pageError);
      // Continue processing other pages
    }
  }
  
  return { slideIds, slidesCreated };
}

// Extract text from a specific PDF page
async function extractTextFromPage(pdfBytes: Uint8Array, pageNum: number): Promise<string> {
  // This is a placeholder - in a real implementation you'd use a proper PDF text extractor
  // that works in Deno environment
  
  try {
    // For now, return a placeholder text
    return `Text content from page ${pageNum}`;
  } catch (error) {
    console.warn(`⚠️ Failed to extract text from page ${pageNum}:`, error);
    return '';
  }
}

// Generate image for a PDF page
async function generatePageImage(
  pdfBytes: Uint8Array, 
  pageNum: number, 
  moduleId: string
): Promise<string | undefined> {
  
  try {
    console.log(`🖼️ Generating image for page ${pageNum}`);
    
    // This is a placeholder - in a real implementation you'd use a proper PDF to image converter
    // For Deno, you might need to use a different approach or external service
    
    // Create a placeholder image (1x1 pixel PNG)
    const placeholderPng = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
      0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    // Save to temporary file
    const tempImagePath = `/tmp/page_${moduleId}_${pageNum}.png`;
    await Deno.writeFile(tempImagePath, placeholderPng);
    
    // Upload to Payload Media
    const imageId = await uploadImageToPayload(tempImagePath, `page_${pageNum}.png`);
    
    // Clean up temp file
    try {
      await Deno.remove(tempImagePath);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up temp image:', cleanupError);
    }
    
    return imageId;
    
  } catch (error) {
    console.error(`❌ Failed to generate image for page ${pageNum}:`, error);
    return undefined;
  }
}

// Analyze slide content with AI
async function analyzeSlideWithAI(text: string): Promise<any> {
  if (!config.openaiApiKey || !text.trim()) {
    return null;
  }
  
  try {
    console.log('🤖 Analyzing slide with AI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Analyze this slide content and provide a JSON response with title, description, and type:
          
Content: ${text}

Please respond with JSON in this format:
{
  "title": "Brief descriptive title",
  "description": "Concise description of the content",
  "type": "regular|quiz|video|reference|resources"
}`
        }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (content) {
      const analysis = JSON.parse(content);
      console.log('🤖 AI analysis completed:', analysis);
      return analysis;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    return null;
  }
}

// Create slide in Payload CMS
async function createSlideInPayload(moduleId: string, slideData: any): Promise<string | undefined> {
  try {
    const response = await fetch(`${config.payloadApiUrl}/api/slides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...slideData,
        parent: parseInt(moduleId, 10),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create slide: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.id?.toString();
    
  } catch (error) {
    console.error('❌ Failed to create slide in Payload:', error);
    return undefined;
  }
}

// Upload image to Payload Media
async function uploadImageToPayload(imagePath: string, filename: string): Promise<string | undefined> {
  try {
    const imageBytes = await Deno.readFile(imagePath);
    const formData = new FormData();
    
    const blob = new Blob([imageBytes], { type: 'image/png' });
    formData.append('file', blob, filename);
    
    const response = await fetch(`${config.payloadApiUrl}/api/media`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.id?.toString();
    
  } catch (error) {
    console.error('❌ Failed to upload image to Payload:', error);
    return undefined;
  }
}

// Update module with slides
async function updateModuleWithSlides(moduleId: string, slideIds: string[]): Promise<void> {
  try {
    // First get existing slides
    const moduleResponse = await fetch(`${config.payloadApiUrl}/api/modules/${moduleId}?depth=0`);
    if (!moduleResponse.ok) {
      throw new Error(`Failed to fetch module: ${moduleResponse.statusText}`);
    }
    
    const module = await moduleResponse.json();
    const existingSlides = module.slides || [];
    
    // Combine existing and new slides
    const allSlides = [...existingSlides, ...slideIds.map(id => parseInt(id, 10))];
    const uniqueSlides = Array.from(new Set(allSlides));
    
    const response = await fetch(`${config.payloadApiUrl}/api/modules/${moduleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slides: uniqueSlides,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update module: ${response.statusText}`);
    }
    
    console.log(`✅ Updated module ${moduleId} with ${uniqueSlides.length} total slides`);
    
  } catch (error) {
    console.error('❌ Failed to update module with slides:', error);
    throw error;
  }
}

console.log('🎯 PDF Processing Edge Function ready to serve requests');
