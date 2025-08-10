import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface SlideAnalysis {
  type: 'regular' | 'video' | 'quiz' | 'reference' | 'resources'
  title: string
  description: string
  confidence: number
}

export class SlideAnalyzer {
  /**
   * Test method to verify JSON parsing works correctly
   */
  private testJsonParsing(testContent: string): void {
    console.log('🧪 Testing JSON parsing with content:', testContent.substring(0, 100) + '...')

    try {
      let jsonContent = testContent.trim()

      // Look for JSON block in markdown format
      const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1]
        console.log('✅ Found JSON in markdown block')
      }

      if (jsonContent.startsWith('{') && jsonContent.endsWith('}')) {
        const parsed = JSON.parse(jsonContent)
        console.log('✅ Successfully parsed JSON:', parsed)
      } else {
        console.log('⚠️ Content is not valid JSON format')
      }
    } catch (error) {
      console.log('❌ JSON parsing failed:', error)
    }
  }
  /**
   * Analyze a slide image to determine its type and generate description
   */
  async analyzeSlide(
    imageBuffer: Buffer,
    pageNumber: number,
    filename: string,
  ): Promise<SlideAnalysis> {
    try {
      console.log(`🔍 Analyzing slide ${pageNumber} from ${filename}...`)

      // Convert buffer to base64 for OpenAI API
      const base64Image = imageBuffer.toString('base64')
      const imageUrl = `data:image/png;base64,${base64Image}`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this slide image and extract the key information. You must respond with ONLY a valid JSON object, no other text.

Guidelines for slide types:
- "regular": Standard content slides with text, images, diagrams, explanations
- "video": Slides that mention videos, have video thumbnails, or video-related content
- "quiz": Slides with questions, multiple choice, assessments, or interactive elements
- "reference": Slides with citations, bibliography, sources, or references
- "resources": Slides with links, additional reading, tools, or resource lists

Create a descriptive title (max 100 chars) and detailed description (max 500 chars) based on the actual content you see in the slide.

Respond with ONLY this JSON format:
{
  "type": "regular",
  "title": "Brief descriptive title based on slide content",
  "description": "Detailed description of what you see in the slide content",
  "confidence": 85
}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for more consistent results
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Parse JSON response
      let analysis: SlideAnalysis
      try {
        // Clean the content to extract JSON if it's wrapped in markdown or other text
        let jsonContent = content.trim()

        // Look for JSON block in markdown format
        const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (jsonMatch) {
          jsonContent = jsonMatch[1]
        }

        // If it starts and ends with curly braces, try to parse it
        if (jsonContent.startsWith('{') && jsonContent.endsWith('}')) {
          const parsed = JSON.parse(jsonContent)
          analysis = {
            type: this.validateSlideType(parsed.type),
            title: this.cleanText(parsed.title, 100),
            description: this.cleanText(parsed.description, 500),
            confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
          }
        } else {
          throw new Error('Response is not valid JSON')
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse OpenAI response, using fallback:', content)

        // Try to extract information from plain text response
        const lines = content.split('\n').filter((line) => line.trim())
        let title = `Slide ${pageNumber}`
        let description = content.substring(0, 500)
        let type: SlideAnalysis['type'] = 'regular'

        // Look for patterns in the response
        for (const line of lines) {
          const lowerLine = line.toLowerCase()
          if (lowerLine.includes('title:') || lowerLine.includes('"title"')) {
            const titleMatch = line.match(/(?:title[:"]\s*["']?)([^"'\n]+)/i)
            if (titleMatch) title = this.cleanText(titleMatch[1], 100)
          }
          if (lowerLine.includes('description:') || lowerLine.includes('"description"')) {
            const descMatch = line.match(/(?:description[:"]\s*["']?)([^"'\n]+)/i)
            if (descMatch) description = this.cleanText(descMatch[1], 500)
          }
          if (lowerLine.includes('type:') || lowerLine.includes('"type"')) {
            const typeMatch = line.match(/(?:type[:"]\s*["']?)([^"'\n]+)/i)
            if (typeMatch) type = this.validateSlideType(typeMatch[1])
          }
        }

        analysis = {
          type,
          title,
          description,
          confidence: 30,
        }
      }

      console.log(`✅ Slide ${pageNumber} analyzed:`, {
        type: analysis.type,
        title: analysis.title.substring(0, 50) + '...',
        confidence: analysis.confidence,
      })

      return analysis
    } catch (error) {
      console.error(`❌ Error analyzing slide ${pageNumber}:`, error)

      // Fallback analysis if AI fails
      return {
        type: 'regular',
        title: `${filename.replace('.pdf', '')} - Page ${pageNumber}`,
        description: `Page ${pageNumber} from ${filename}`,
        confidence: 0,
      }
    }
  }

  /**
   * Validate and normalize slide type
   */
  private validateSlideType(type: string): SlideAnalysis['type'] {
    const validTypes: SlideAnalysis['type'][] = [
      'regular',
      'video',
      'quiz',
      'reference',
      'resources',
    ]
    const normalizedType = type?.toLowerCase()

    if (validTypes.includes(normalizedType as SlideAnalysis['type'])) {
      return normalizedType as SlideAnalysis['type']
    }

    return 'regular' // Default fallback
  }

  /**
   * Clean and truncate text
   */
  private cleanText(text: string, maxLength: number): string {
    if (!text) return ''

    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, maxLength)
      .trim()
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

        // Rate limiting: wait 1 second between requests to avoid hitting OpenAI limits
        if (i < slides.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`❌ Failed to analyze slide ${slide.pageNumber}:`, error)
        // Add fallback result
        results.push({
          type: 'regular',
          title: `${filename.replace('.pdf', '')} - Page ${slide.pageNumber}`,
          description: `Page ${slide.pageNumber} from ${filename}`,
          confidence: 0,
        })
      }
    }

    console.log(`✅ Batch analysis complete: ${results.length} slides analyzed`)
    return results
  }
}
