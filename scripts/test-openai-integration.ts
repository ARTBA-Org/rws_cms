import 'dotenv/config'
import { SlideAnalyzer } from '../src/utils/slideAnalyzer'
import { readFileSync } from 'fs'
import path from 'path'
import { convertPDFPageToImage } from '../src/utils/pdfToImagePuppeteer'

async function testOpenAIIntegration() {
    console.log('🧪 Testing OpenAI Slide Analysis Integration...')

    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ OPENAI_API_KEY not set. Testing structure only...')

        // Test instantiation
        try {
            new SlideAnalyzer()
            console.log('❌ SlideAnalyzer should throw without API key')
        } catch (e) {
            console.log('✅ SlideAnalyzer correctly requires API key:', e.message)
        }
        return
    }

    try {
        // Load sample PDF and convert to image
        const pdfPath = path.join(process.cwd(), 'sample-local-pdf.pdf')
        const pdfBuffer = readFileSync(pdfPath)
        console.log('📄 Loaded PDF:', pdfBuffer.length, 'bytes')

        // Convert first page to image
        const imageBuffer = await convertPDFPageToImage(pdfBuffer, 1)
        if (!imageBuffer) {
            throw new Error('Failed to convert PDF to image')
        }
        console.log('🖼️ Generated image:', imageBuffer.length, 'bytes')

        // Test slide analysis with updated OpenAI format
        const analyzer = new SlideAnalyzer()
        console.log('🤖 Testing OpenAI Responses API...')

        const analysis = await analyzer.analyzeSlide(imageBuffer, 1, 'sample-local-pdf.pdf')

        console.log('✅ Analysis completed:')
        console.log('  Title:', analysis.Title)
        console.log('  Description length:', analysis.Description.length)
        console.log('  Type:', analysis.Type)

    } catch (error) {
        console.error('❌ Test failed:', error.message)
        if (error.status) {
            console.error('  HTTP Status:', error.status)
            console.error('  Error Code:', error.code)
            console.error('  Details:', error.param || error.type)
        }
    }
}

testOpenAIIntegration()
