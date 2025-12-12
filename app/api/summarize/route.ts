import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, type } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const maxLength = type === 'short' ? 200 : 400
    const minLength = type === 'short' ? 100 : 200

    // Limit text length to avoid token limits (approximately 1024 tokens max)
    const MAX_INPUT_LENGTH = 3500 // characters
    const truncatedText = text.length > MAX_INPUT_LENGTH 
      ? text.substring(0, MAX_INPUT_LENGTH) + '...'
      : text

    // Using HuggingFace Inference API (free tier)
    const API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn'

    let retryCount = 0
    const maxRetries = 3

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: truncatedText,
            parameters: {
              max_length: maxLength,
              min_length: minLength,
              do_sample: false,
            },
          }),
        })

        if (!response.ok) {
          // If model is loading (503), retry after waiting
          if (response.status === 503 && retryCount < maxRetries) {
            const waitTime = (retryCount + 1) * 2000 // Wait 2s, 4s, 6s
            await new Promise(resolve => setTimeout(resolve, waitTime))
            retryCount++
            continue
          }
          
          if (response.status === 503) {
            return NextResponse.json(
              { error: 'Model is taking longer than expected to load. Please try again in a moment.' },
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
          // Format: [{summary_text: "..."}]
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
          // Fallback: extract meaningful content (remove headers, get substantive sentences)
          const sentences = truncatedText
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => {
              // Filter out very short sentences, numbers only, and common headers
              if (s.length < 10) return false
              if (/^\d+$/.test(s)) return false
              if (/Copyright|All rights reserved|Page|Slide|Chapter \d+/i.test(s)) return false
              return true
            })
          
          const count = type === 'short' ? Math.min(5, sentences.length) : Math.min(10, sentences.length)
          summary = sentences.slice(0, count).join('. ').trim()
          if (summary && !summary.endsWith('.')) summary += '.'
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
    console.error('Summarization error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

