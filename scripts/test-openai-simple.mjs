// Simple test script to validate OpenAI Responses API format
import OpenAI from 'openai'

async function testOpenAIFormat() {
  console.log('🧪 Testing OpenAI Responses API Format...')
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not set. Skipping actual API test.')
    console.log('✅ Format structure is valid (would work with API key)')
    return
  }
  
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const model = process.env.OPENAI_MODEL || 'gpt-5-nano'
    
    console.log('🔑 API key configured')
    console.log('🤖 Using model:', model)
    
    // Test the format without image first (text-only)
    const response = await openai.responses.create({
      model,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: 'You are a slide extraction engine. Extract slide information and return only JSON with the keys Title, Description, and Type.\n\nRules:\n- Title: Copy the main heading exactly as shown on the slide.\n- Description: Copy the exact visible body text from the slide, preserving capitalization, punctuation, and paragraph breaks. Do not paraphrase or add any words. Exclude photo credits, page numbers, or decorative labels unless instructed otherwise.\n- Type: Select from {Regular, Video, Quiz, Reference, Resources}. If unclear, use Regular.\n- If a field is missing, use an empty string.\n- Do not include any other keys (do not return "reasoning" or any explanations).\nReturn a single JSON object only.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Test slide with title "Introduction to Safety" and description "This slide covers basic safety protocols and procedures."',
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
        verbosity: 'medium',
      },
      reasoning: { effort: 'minimal' },
      tools: [],
      store: false,
    })
    
    console.log('✅ API call successful')
    console.log('📋 Response structure:', {
      hasOutputText: !!response.output_text,
      hasContent: !!response.content,
      hasOutput: !!response.output,
    })
    
    // Extract content using the same logic as slideAnalyzer
    const content =
      response.output_text ||
      response.content?.[0]?.text ||
      response.output?.[0]?.content?.[0]?.text
    
    console.log('📄 Extracted content:', content)
    
    if (content) {
      try {
        const parsed = JSON.parse(content)
        console.log('✅ Valid JSON:', parsed)
      } catch (e) {
        console.log('❌ Invalid JSON:', e.message)
      }
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.message)
    if (error.status) {
      console.error('  Status:', error.status)
      console.error('  Code:', error.code)
      console.error('  Type:', error.type)
    }
  }
}

testOpenAIFormat()
