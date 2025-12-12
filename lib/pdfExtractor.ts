import * as pdfjsLib from 'pdfjs-dist'

// Set worker source for pdf.js (using unpkg CDN for better reliability)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
}

function cleanExtractedText(text: string): string {
  // Remove copyright notices (multiple variations)
  text = text.replace(/Copyright\s*©\s*\d{4}[^.]*\./gi, '')
  text = text.replace(/Copyright\s*©\s*\d{4}[^.]*All rights reserved[^.]*\./gi, '')
  text = text.replace(/©\s*\d{4}[^.]*Macmillan Learning[^.]*\./gi, '')
  
  // Remove "All rights reserved" variations
  text = text.replace(/All\s+rights\s+reserved\.?/gi, '')
  
  // Remove page/slide numbers (standalone numbers or with labels)
  text = text.replace(/^(Page|Slide|P\.?)\s*\d+$/gim, '')
  text = text.replace(/^\s*\d+\s*$/gm, '') // Lines with just a number
  
  // Remove common headers/footers patterns
  text = text.replace(/Chapter\s+\d+[^.]*\.?/gi, '')
  text = text.replace(/Roadmap\s*\(\d+\s+of\s+\d+\)/gi, '')
  text = text.replace(/^\d+\s+Copyright/gi, '')
  
  // Split into lines for more granular cleaning
  const lines = text.split('\n')
  const cleanedLines: string[] = []
  const seenLines = new Set<string>()
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip empty lines
    if (!trimmed) continue
    
    // Skip lines that are just numbers (page/slide numbers)
    if (/^\d{1,3}$/.test(trimmed)) continue
    
    // Skip copyright-related lines
    if (/Copyright|All rights reserved|©\s*\d{4}/i.test(trimmed)) continue
    
    // Skip very short lines that are likely artifacts
    if (trimmed.length < 3) continue
    
    // Skip repetitive lines (headers/footers that repeat)
    const normalized = trimmed.toLowerCase()
    if (seenLines.has(normalized) && cleanedLines.length > 5) {
      // Allow some repetition but not too much
      continue
    }
    seenLines.add(normalized)
    
    cleanedLines.push(trimmed)
  }
  
  text = cleanedLines.join('\n')
  
  // Remove excessive whitespace
  text = text.replace(/\s{3,}/g, ' ')
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n')
  
  // Remove remaining standalone small numbers (likely page numbers)
  text = text.replace(/\b\d{1,2}\b(?=\s|$|\n)/g, '')
  
  return text.trim()
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages
  let fullText = ''

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    fullText += pageText + '\n\n'
  }

  // Clean the extracted text to remove headers, footers, copyright, etc.
  return cleanExtractedText(fullText)
}

