import OpenAI from 'openai'
import { withRetry, isRetryableOpenAIError } from './retryUtils'
import { PDF_CONFIG } from './pdfConfig'
import type { SlideType } from '../types/pdfTypes'

export interface SlideAnalysis {
  Title: string
  Description: string
  Type: SlideType
}

export class SlideAnalyzer {
  private openai: OpenAI

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.')
    }
    this.openai = new OpenAI({ apiKey })
  }

  /**
   * Analyze a single slide image using OpenAI Responses API.
   */
  async analyzeSlide(imageBuffer: Buffer, pageNumber: number, filename: string): Promise<SlideAnalysis> {
    try {
      const imageBase64 = imageBuffer.toString('base64')
      const model = PDF_CONFIG.openaiModel

      const response: any = await withRetry(
        () => this.openai.responses.create({
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
                type: 'input_image',
                image_url: `data:image/png;base64,${imageBase64}`,
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
      }),
        {
          maxRetries: PDF_CONFIG.aiRetryAttempts,
          baseDelayMs: 1000,
          retryCondition: isRetryableOpenAIError,
        }
      )

      // Extract text content from Responses API (handle multiple shapes safely)
      const content: unknown =
        (response && (response as any).output_text) ||
        (response && (response as any).content)?.[0]?.text ||
        (response && (response as any).output)?.[0]?.content?.[0]?.text

      if (!content || typeof content !== 'string') {
        throw new Error('No text content in OpenAI response')
      }

      console.log(`🤖 AI Response for slide ${pageNumber}:`)
      console.log('Raw content:', content)

      let analysis: SlideAnalysis
      try {
        const parsed = JSON.parse(content)
        analysis = {
          Title: this.cleanText(parsed.Title, 100),
          Description: this.cleanText(parsed.Description, 1000),
          Type: this.validateSlideType(parsed.Type),
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse OpenAI response, using fallback:', content)
        console.error('Parse error details:', parseError)
        analysis = {
          Title: `Slide ${pageNumber}`,
          Description: `Page ${pageNumber} from ${filename}`,
          Type: 'Regular',
        }
      }

      console.log(`✅ Final analysis for slide ${pageNumber}:`, {
        Type: analysis.Type,
        Title: analysis.Title.substring(0, 50) + (analysis.Title.length > 50 ? '...' : ''),
        DescriptionLength: analysis.Description.length,
      })

      return analysis
    } catch (error) {
      console.error(`❌ Error analyzing slide ${pageNumber}:`, error)
      return {
        Title: `${filename.replace('.pdf', '')} - Page ${pageNumber}`,
        Description: `Page ${pageNumber} from ${filename}`,
        Type: 'Regular',
      }
    }
  }

  /**
   * Validate and normalize slide type
   */
  private validateSlideType(type: string): SlideAnalysis['Type'] {
    const validTypes: SlideAnalysis['Type'][] = [
      'Regular',
      'Video',
      'Quiz',
      'Reference',
      'Resources',
    ]

    const normalizedType = type?.charAt(0).toUpperCase() + type?.slice(1).toLowerCase()
    if (validTypes.includes(normalizedType as SlideAnalysis['Type'])) {
      return normalizedType as SlideAnalysis['Type']
    }
    return 'Regular'
  }

  /**
   * Clean and truncate text
   */
  private cleanText(text: string, maxLength: number): string {
    if (!text) return ''
    return text.trim().replace(/\s+/g, ' ').substring(0, maxLength).trim()
  }

  /**
   * Batch analyze multiple slides with rate limiting
   */
  async analyzeSlides(
    slides: Array<{ buffer: Buffer; pageNumber: number }>,
    filename: string,
  ): Promise<SlideAnalysis[]> {
    const results: SlideAnalysis[] = []
    console.log(`🔍 Starting batch analysis of ${slides.length} slides...`)

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      try {
        const analysis = await this.analyzeSlide(slide.buffer, slide.pageNumber, filename)
        results.push(analysis)
        if (i < slides.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`❌ Failed to analyze slide ${slide.pageNumber}:`, error)
        results.push({
          Title: `${filename.replace('.pdf', '')} - Page ${slide.pageNumber}`,
          Description: `Page ${slide.pageNumber} from ${filename}`,
          Type: 'Regular',
        })
      }
    }

    console.log(`✅ Batch analysis complete: ${results.length} slides analyzed`)
    return results
  }
}
