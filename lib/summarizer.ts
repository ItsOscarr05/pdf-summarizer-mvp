import { generateStructuredSummary } from './structuredSummarizer';
import { preprocessText } from './textPreprocessor';

export async function summarizeText(
  text: string,
  type: 'short' | 'detailed' = 'detailed'
): Promise<string> {
  // Use structured summarization for better quality
  try {
    // Preprocess first
    const preprocessed = preprocessText(text);

    // For very long texts, we still need chunking
    const maxLength = 3000; // Increased for better context
    const chunks = chunkText(preprocessed.normalized, maxLength);

    if (chunks.length === 1) {
      // Single chunk - use structured summarization directly
      return await generateStructuredSummary(chunks[0], type);
    }

    // Multiple chunks - summarize each, then merge
    let summaries: string[] = [];

    for (const chunk of chunks) {
      try {
        // Use structured summarization for each chunk
        const chunkSummary = await generateStructuredSummary(chunk, type);
        summaries.push(chunkSummary);
      } catch (error: any) {
        console.error('Error summarizing chunk:', error);
        // If one chunk fails, use intelligent fallback - extract key sentences
        const sentences = chunk
          .split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => {
            // Filter out very short sentences and common noise
            if (s.length < 15) return false;
            if (/Copyright|All rights reserved|Page \d+|Slide \d+/i.test(s)) return false;
            if (/^\d+$/.test(s)) return false;
            return true;
          });

        const count =
          type === 'short' ? Math.min(5, sentences.length) : Math.min(10, sentences.length);
        const fallback = sentences.slice(0, count).join('. ').trim();
        if (fallback) {
          summaries.push(fallback + (fallback.endsWith('.') ? '' : '.'));
        }
      }
    }

    // Merge summaries using structured approach
    if (summaries.length > 1) {
      try {
        const combinedSummaries = summaries.join('\n\n---\n\n');
        // Re-summarize the merged summaries with structured approach
        return await generateStructuredSummary(combinedSummaries, type);
      } catch (error) {
        console.error('Error merging summaries:', error);
        // Fallback: return joined summaries with separator
        return summaries.join('\n\n---\n\n');
      }
    }

    return summaries[0] || 'Could not generate summary.';
  } catch (error: any) {
    console.error('Structured summarization failed, falling back to basic:', error);
    // Fallback to basic summarization
    return await basicSummarization(text, type);
  }
}

/**
 * Basic summarization fallback
 */
async function basicSummarization(
  text: string,
  type: 'short' | 'detailed' = 'short'
): Promise<string> {
  const maxLength = 2000;
  const chunks = chunkText(text, maxLength);
  let summaries: string[] = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: chunk,
          type: type,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.summary) {
        summaries.push(data.summary);
      }
    } catch (error) {
      console.error('Error in basic summarization:', error);
    }
  }

  if (summaries.length > 1) {
    try {
      const combined = summaries.join('\n\n');
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: combined,
          type: type,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          return data.summary;
        }
      }
    } catch (error) {
      console.error('Error merging basic summaries:', error);
    }
    return summaries.join('\n\n');
  }

  return summaries[0] || 'Could not generate summary.';
}

function chunkText(text: string, maxLength: number): string[] {
  // If text is short enough, return as single chunk
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];

  // Enhanced chunking: prefer section boundaries
  const sectionMarkers = /##SECTION##/g;
  const hasSectionMarkers = sectionMarkers.test(text);

  if (hasSectionMarkers) {
    // Split by sections, preserving section markers
    const sections = text.split(/(##SECTION##[^#]+##SECTION##)/);
    let currentChunk = '';

    for (const section of sections) {
      if ((currentChunk + section).length > maxLength && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = section;
      } else {
        currentChunk = currentChunk + section;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
  }

  // If no sections or chunking failed, use paragraph-based chunking
  if (chunks.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    if (paragraphs.length > 1) {
      let currentChunk = '';

      for (const paragraph of paragraphs) {
        if ((currentChunk + '\n\n' + paragraph).length > maxLength && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    } else {
      // Fall back to sentence splitting with overlap
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let currentChunk = '';

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        if ((currentChunk + ' ' + sentence).length > maxLength && currentChunk) {
          chunks.push(currentChunk.trim());
          // Start new chunk with last 200 chars for overlap (better continuity)
          currentChunk = currentChunk.slice(-200) + ' ' + sentence;
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
}
