export async function summarizeText(
  text: string,
  type: 'short' | 'detailed' = 'short'
): Promise<string> {
  // Chunk text if it's too long (HuggingFace models have token limits)
  const maxLength = 2000 // Approximate token limit for free tier
  const chunks = chunkText(text, maxLength)

  let summaries: string[] = []

  for (const chunk of chunks) {
    try {
      const summary = await summarizeChunk(chunk, type)
      summaries.push(summary)
    } catch (error) {
      console.error('Error summarizing chunk:', error)
      // If one chunk fails, try to continue with others
      summaries.push(chunk.substring(0, 200) + '...') // Fallback: first 200 chars
    }
  }

  // If we have multiple chunks, summarize the summaries
  if (summaries.length > 1) {
    const combinedSummaries = summaries.join('\n\n')
    return await summarizeChunk(combinedSummaries, type)
  }

  return summaries[0] || 'Could not generate summary.'
}

async function summarizeChunk(
  text: string,
  type: 'short' | 'detailed'
): Promise<string> {
  // Using HuggingFace Inference API (free tier)
  // Model: facebook/bart-large-cnn (good for summarization)
  const API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn'

  const maxLength = type === 'short' ? 200 : 400
  const minLength = type === 'short' ? 100 : 200

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text,
      parameters: {
        max_length: maxLength,
        min_length: minLength,
        do_sample: false,
      },
    }),
  })

  if (!response.ok) {
    // If rate limited or model is loading, try a fallback approach
    if (response.status === 503) {
      throw new Error('Model is loading. Please wait a moment and try again.')
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a minute.')
    }
    throw new Error(`API error: ${response.statusText}`)
  }

  const data = await response.json()

  if (Array.isArray(data) && data[0] && data[0].summary_text) {
    return data[0].summary_text
  }

  if (data.error) {
    throw new Error(data.error)
  }

  // Fallback: return a simple extraction if API doesn't work
  return extractFallbackSummary(text, type)
}

function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.length > 0 ? chunks : [text]
}

function extractFallbackSummary(text: string, type: 'short' | 'detailed'): string {
  // Simple fallback: take first few sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const count = type === 'short' ? 3 : 6
  return sentences.slice(0, count).join(' ')
}

