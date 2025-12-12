/**
 * Advanced Text Preprocessing Engine
 * Handles normalization, section detection, and structure inference
 */

export interface PreprocessedText {
  normalized: string
  detectedSections: string[]
  detectedEntities: string[]
  estimatedStructure: 'academic' | 'lecture' | 'article' | 'mixed'
}

export function preprocessText(text: string): PreprocessedText {
  let normalized = text

  // Step 1: Aggressive normalization
  normalized = normalizeWhitespace(normalized)
  normalized = unifyBullets(normalized)
  normalized = reconstructSentences(normalized)
  normalized = removeDuplicates(normalized)
  normalized = detectAndMarkSections(normalized)

  // Step 2: Structure inference
  const detectedSections = extractSections(normalized)
  const detectedEntities = extractEntities(normalized)
  const estimatedStructure = inferStructure(normalized, detectedSections)

  return {
    normalized,
    detectedSections,
    detectedEntities,
    estimatedStructure,
  }
}

function normalizeWhitespace(text: string): string {
  // Normalize all types of whitespace
  text = text.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // Non-breaking spaces
  text = text.replace(/\r\n/g, '\n') // Windows line endings
  text = text.replace(/\r/g, '\n') // Mac line endings
  text = text.replace(/\t/g, ' ') // Tabs to spaces
  text = text.replace(/[ \t]+/g, ' ') // Multiple spaces to single
  text = text.replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
  return text.trim()
}

function unifyBullets(text: string): string {
  // Convert all bullet types to standard format
  const bulletPatterns = [
    /^[\u2022\u2023\u2043\u2219\u25E6\u25AA\u25AB\u25CF\u25CB\u25A1\u25AA]\s*/gm, // Unicode bullets
    /^[oO]\s+(?=[A-Z])/gm, // Letter o bullets
    /^[-*]\s+(?=[A-Z])/gm, // Dash/asterisk bullets
  ]

  bulletPatterns.forEach(pattern => {
    text = text.replace(pattern, '• ')
  })

  return text
}

function reconstructSentences(text: string): string {
  // Reconstruct sentences broken across lines
  const lines = text.split('\n')
  const reconstructed: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      reconstructed.push('')
      continue
    }

    // If line doesn't end with punctuation and next line starts lowercase, merge
    if (i < lines.length - 1) {
      const nextLine = lines[i + 1].trim()
      const endsWithPunct = /[.!?:]$/.test(line)
      const nextStartsLower = /^[a-z]/.test(nextLine)
      const nextStartsBullet = /^[•\-\*\d]/.test(nextLine)
      
      if (!endsWithPunct && nextStartsLower && !nextStartsBullet) {
        // Merge with next line
        reconstructed.push(line + ' ' + nextLine)
        i++ // Skip next line as it's merged
        continue
      }
    }

    reconstructed.push(line)
  }

  return reconstructed.join('\n')
}

function removeDuplicates(text: string): string {
  const lines = text.split('\n')
  const seen = new Set<string>()
  const unique: string[] = []
  let consecutiveDuplicateCount = 0

  for (const line of lines) {
    const normalized = line.trim().toLowerCase()
    
    // Skip if exact duplicate
    if (normalized && seen.has(normalized)) {
      consecutiveDuplicateCount++
      // Only skip if we've seen many duplicates (likely headers/footers)
      // Allow first 2 duplicates but skip 3rd and beyond
      if (consecutiveDuplicateCount >= 3) {
        continue
      }
    } else {
      consecutiveDuplicateCount = 0
    }

    if (normalized) {
      seen.add(normalized)
    }
    
    unique.push(line)
  }

  return unique.join('\n')
}

function detectAndMarkSections(text: string): string {
  // Mark potential section headers for better structure detection
  const lines = text.split('\n')
  const marked: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      marked.push('')
      continue
    }

    // Detect section headers
    const isAllCaps = /^[A-Z][A-Z\s&:]{10,}$/.test(line) && line.length < 100
    const endsWithColon = /:\s*$/.test(line) && line.length < 80
    const startsWithSectionWord = /^(Introduction|Chapter|Section|Part|Summary|Conclusion|Overview|Definition|Example|Key|Main)/i.test(line)
    
    if (isAllCaps || (endsWithColon && line.length > 10) || startsWithSectionWord) {
      // Mark as section header
      marked.push(`##SECTION##${line}##SECTION##`)
    } else {
      marked.push(line)
    }
  }

  return marked.join('\n')
}

function extractSections(text: string): string[] {
  const sections: string[] = []
  const sectionMatches = text.match(/##SECTION##(.*?)##SECTION##/g)
  
  if (sectionMatches) {
    sectionMatches.forEach(match => {
      const section = match.replace(/##SECTION##/g, '')
      if (section && !sections.includes(section)) {
        sections.push(section)
      }
    })
  }

  return sections
}

function extractEntities(text: string): string[] {
  // Extract potential key terms (capitalized phrases, defined terms)
  const entities: Set<string> = new Set()
  
  // Definitions (Term: definition)
  const definitionMatches = text.match(/([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*):\s+[^.\n]+/g)
  if (definitionMatches) {
    definitionMatches.forEach(match => {
      const term = match.split(':')[0].trim()
      if (term.length > 3 && term.length < 50) {
        entities.add(term)
      }
    })
  }

  // Bolded terms (already extracted in some cases)
  const boldMatches = text.match(/\*\*([^*]+)\*\*/g)
  if (boldMatches) {
    boldMatches.forEach(match => {
      const term = match.replace(/\*\*/g, '').trim()
      if (term.length > 3 && term.length < 50) {
        entities.add(term)
      }
    })
  }

  return Array.from(entities).slice(0, 20) // Limit to top 20
}

function inferStructure(text: string, sections: string[]): 'academic' | 'lecture' | 'article' | 'mixed' {
  const lowerText = text.toLowerCase()
  
  let academicScore = 0
  let lectureScore = 0
  let articleScore = 0

  // Academic indicators
  if (/citation|reference|methodology|hypothesis|results|discussion/i.test(text)) academicScore++
  if (/\d+\.\d+\.\d+/.test(text)) academicScore++ // Numbered sections
  if (sections.some(s => /chapter|section|part \d+/i.test(s))) academicScore++

  // Lecture indicators
  if (/learning objective|key takeaway|practice question|example|case study/i.test(text)) lectureScore++
  if (sections.some(s => /slide|lecture|class/i.test(s))) lectureScore++
  if (/you will learn|after this/i.test(text)) lectureScore++

  // Article indicators
  if (/by [A-Z]|published|author/i.test(text)) articleScore++
  if (sections.some(s => /introduction|conclusion|summary/i.test(s))) articleScore++

  if (academicScore > lectureScore && academicScore > articleScore) return 'academic'
  if (lectureScore > articleScore) return 'lecture'
  if (articleScore > 0) return 'article'
  return 'mixed'
}

