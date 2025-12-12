/**
 * Structured Summary Generator
 * Creates ChatGPT-level hierarchical summaries with consistent formatting
 */

import { preprocessText, PreprocessedText } from './textPreprocessor';

export interface StructuredSummary {
  mainSummary: string;
  keySections: Section[];
  criticalInsights: string[];
  finalTakeaways: string[];
  rawMarkdown: string;
}

export interface Section {
  title: string;
  content: string[];
  subsections?: Section[];
}

/**
 * Builds a structured prompt for the LLM that enforces hierarchical output
 */
function buildStructuredPrompt(
  text: string,
  preprocessed: PreprocessedText,
  type: 'short' | 'detailed'
): string {
  const instruction = `You are an expert academic summarizer. Transform the following text into a clear, structured, polished summary with strong visual hierarchy and consistent formatting.

CRITICAL OUTPUT FORMAT (follow exactly):

# Summary
[1 concise paragraph of main ideas - 2-4 sentences]

# Key Sections Identified
[List 3-7 major sections or themes found in the text, one per line]

# Detailed Breakdown
[For each major section, create a subsection with this format:]
## [Section Name]
- [Main point 1]
- [Main point 2]
- [Additional points as needed]

[Repeat for all major sections]

# Critical Insights
- [Insight 1 - highest-level meaning]
- [Insight 2 - important patterns or relationships]
- [Insight 3-7 as needed]

# Final Takeaways
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3-5]

RULES:
- Use Markdown headers (# and ##) for structure
- Never repeat information
- Never output raw extracted fragments
- Write concisely and professionally
- If no clear structure exists, create a logical one
- Focus on concepts, definitions, examples, and relationships
- Remove any copyright notices, page numbers, or metadata

${
  preprocessed.detectedSections.length > 0
    ? `\nDetected sections in the text: ${preprocessed.detectedSections.slice(0, 5).join(', ')}`
    : ''
}
${
  preprocessed.estimatedStructure !== 'mixed'
    ? `\nDocument type appears to be: ${preprocessed.estimatedStructure}`
    : ''
}

Now summarize this text:\n\n${text.substring(0, 3000)}`;

  return instruction;
}

/**
 * Parses structured markdown output into a structured summary object
 */
function parseStructuredOutput(markdown: string): StructuredSummary {
  const sections: Section[] = [];
  let mainSummary = '';
  const criticalInsights: string[] = [];
  const finalTakeaways: string[] = [];

  // Extract main summary (between # Summary and next #)
  const summaryMatch = markdown.match(/#\s*Summary\s*\n+([^#]+?)(?=\n#|\n*$)/i);
  if (summaryMatch) {
    mainSummary = summaryMatch[1].trim();
  }

  // Extract key sections
  const sectionsMatch = markdown.match(/#\s*Key\s*Sections[^#]+?\n+([^#]+?)(?=\n#|\n*$)/i);
  if (sectionsMatch) {
    const sectionLines = sectionsMatch[1]
      .split('\n')
      .filter(l => l.trim() && /^[-•*]/.test(l.trim()));
    // Parse sections from Detailed Breakdown
    const breakdownMatch = markdown.match(
      /#\s*Detailed\s*Breakdown[^#]+?\n+([^#]+?)(?=\n#|\n*$)/is
    );
    if (breakdownMatch) {
      const breakdownText = breakdownMatch[1];
      const sectionMatches = breakdownText.matchAll(/##\s*([^\n]+)\n+([^##]+?)(?=\n##|\n*$)/g);

      for (const match of sectionMatches) {
        sections.push({
          title: match[1].trim(),
          content: match[2]
            .split('\n')
            .filter(
              l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*')
            )
            .map(l => l.replace(/^[-•*]\s+/, '').trim())
            .filter(l => l.length > 0),
        });
      }
    }
  }

  // Extract critical insights
  const insightsMatch = markdown.match(/#\s*Critical\s*Insights[^#]+?\n+([^#]+?)(?=\n#|\n*$)/i);
  if (insightsMatch) {
    const insightsText = insightsMatch[1];
    criticalInsights.push(
      ...insightsText
        .split('\n')
        .filter(
          l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*')
        )
        .map(l => l.replace(/^[-•*]\s+/, '').trim())
        .filter(l => l.length > 0)
    );
  }

  // Extract final takeaways
  const takeawaysMatch = markdown.match(/#\s*Final\s*Takeaways[^#]+?\n+([^#]+?)(?=\n#|\n*$)/i);
  if (takeawaysMatch) {
    const takeawaysText = takeawaysMatch[1];
    finalTakeaways.push(
      ...takeawaysText
        .split('\n')
        .filter(
          l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*')
        )
        .map(l => l.replace(/^[-•*]\s+/, '').trim())
        .filter(l => l.length > 0)
    );
  }

  return {
    mainSummary: mainSummary || markdown.split('\n#')[0].trim(),
    keySections: sections,
    criticalInsights: criticalInsights.slice(0, 7),
    finalTakeaways: finalTakeaways.slice(0, 5),
    rawMarkdown: markdown,
  };
}

/**
 * Main function to generate structured summary
 */
export async function generateStructuredSummary(
  text: string,
  type: 'short' | 'detailed' = 'detailed'
): Promise<string> {
  // Step 1: Preprocess
  const preprocessed = preprocessText(text);

  // Step 2: Clean text - remove section markers before sending to LLM
  const cleanText = text.replace(/##SECTION##/g, '').trim();

  // Step 3: Build structured prompt
  const prompt = buildStructuredPrompt(cleanText, preprocessed, type);

  // Step 4: Call summarization API with structured prompt
  try {
    const response = await fetch('/api/summarize-structured', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        type: type,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.summary) {
      throw new Error('No summary returned');
    }

    // Step 5: Parse and format the structured output
    const structured = parseStructuredOutput(data.summary);

    // Step 6: Convert to formatted markdown for display
    return formatStructuredSummary(structured);
  } catch (error: any) {
    console.error('Structured summarization error:', error);
    // Fallback to regular summarization
    throw error;
  }
}

/**
 * Formats structured summary into display-ready markdown
 */
function formatStructuredSummary(structured: StructuredSummary): string {
  let output = '';

  // Main summary
  if (structured.mainSummary) {
    output += `📌 Summary\n\n${structured.mainSummary}\n\n`;
  }

  // Key sections
  if (structured.keySections.length > 0) {
    output += `📂 Key Sections\n\n`;
    structured.keySections.forEach((section, idx) => {
      output += `## ${section.title}\n`;
      section.content.forEach(point => {
        output += `• ${point}\n`;
      });
      if (idx < structured.keySections.length - 1) output += '\n';
    });
    output += '\n';
  }

  // Critical insights
  if (structured.criticalInsights.length > 0) {
    output += `🔍 Critical Insights\n\n`;
    structured.criticalInsights.forEach(insight => {
      output += `• ${insight}\n`;
    });
    output += '\n';
  }

  // Final takeaways
  if (structured.finalTakeaways.length > 0) {
    output += `🎯 Final Takeaways\n\n`;
    structured.finalTakeaways.forEach(takeaway => {
      output += `• ${takeaway}\n`;
    });
  }

  return output.trim() || structured.rawMarkdown;
}

/**
 * Cleans and formats raw output even if it's not perfectly structured
 */
function cleanAndFormatOutput(text: string): string {
  // Remove section markers if they leaked through
  text = text.replace(/##SECTION##/g, '');

  // Ensure proper spacing
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
