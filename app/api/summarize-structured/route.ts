import { NextRequest, NextResponse } from 'next/server'

/**
 * Enhanced API route for structured summarization
 * Uses instruction-following prompts to get hierarchical output
 */
export async function POST(request: NextRequest) {
  try {
    const { text, type } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // For structured output, we need longer responses
    const maxLength = type === 'short' ? 400 : 800
    const minLength = type === 'short' ? 200 : 400

    // Limit input length (the prompt itself adds instructions)
    const MAX_INPUT_LENGTH = 3000 // characters
    const inputText = text.length > MAX_INPUT_LENGTH 
      ? text.substring(0, MAX_INPUT_LENGTH) + '...'
      : text

    // Using HuggingFace Inference API
    // Try a model better suited for instruction following
    const API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn'
    
    // Alternative: Try mistral if available, but BART is more reliable for now
    // const API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2'

    let retryCount = 0
    const maxRetries = 3

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.HUGGINGFACE_API_KEY && {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            }),
          },
          body: JSON.stringify({
            inputs: inputText,
            parameters: {
              max_length: maxLength,
              min_length: minLength,
              do_sample: false,
              temperature: 0.3, // Lower temperature for more consistent output
            },
          }),
        })

        if (!response.ok) {
          if (response.status === 503 && retryCount < maxRetries) {
            const waitTime = (retryCount + 1) * 2000
            await new Promise(resolve => setTimeout(resolve, waitTime))
            retryCount++
            continue
          }
          
          if (response.status === 503) {
            return NextResponse.json(
              { error: 'Model is loading. Please try again in a moment.' },
              { status: 503 }
            )
          }
          
          if (response.status === 429) {
            return NextResponse.json(
              { error: 'Rate limit exceeded. Please wait a minute and try again.' },
              { status: 429 }
            )
          }
          
          const errorText = await response.text()
          return NextResponse.json(
            { error: `API error (${response.status}): ${errorText || response.statusText}` },
            { status: response.status }
          )
        }

        const data = await response.json()

        // Handle different response formats
        let summary = null
        
        if (Array.isArray(data)) {
          summary = data[0]?.summary_text || data[0]?.generated_text
        } else if (data.summary_text) {
          summary = data.summary_text
        } else if (data.generated_text) {
          summary = data.generated_text
        } else if (data.error) {
          return NextResponse.json(
            { error: data.error },
            { status: 500 }
          )
        }

        if (!summary) {
          // Enhanced fallback: create structured output from extracted sentences
          summary = createFallbackStructuredSummary(inputText, type)
        }

        return NextResponse.json({ summary })
      } catch (fetchError: any) {
        if (retryCount < maxRetries) {
          retryCount++
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        throw fetchError
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate summary after retries' },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('Structured summarization error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate structured summary' },
      { status: 500 }
    )
  }
}

/**
 * Fallback: Create a basic structured summary from extracted sentences
 */
function createFallbackStructuredSummary(text: string, type: 'short' | 'detailed'): string {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => {
      if (s.length < 15) return false
      if (/^\d+$/.test(s)) return false
      if (/Copyright|All rights reserved|Page|Slide|Chapter \d+/i.test(s)) return false
      return true
    })

  const count = type === 'short' ? Math.min(8, sentences.length) : Math.min(15, sentences.length)
  const selectedSentences = sentences.slice(0, count)

  // Create basic structure
  let summary = '# Summary\n\n'
  summary += selectedSentences.slice(0, 2).join(' ') + '\n\n'
  
  summary += '# Key Points\n\n'
  selectedSentences.slice(2, Math.min(7, selectedSentences.length)).forEach(s => {
    summary += `• ${s}\n`
  })

  return summary
}

