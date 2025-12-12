'use client';

import { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { extractTextFromPDF } from '@/lib/pdfExtractor';

import { summarizeText } from '@/lib/summarizer';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [summaryType, setSummaryType] = useState<'short' | 'detailed'>('short');
  const [donationModal, setDonationModal] = useState<'cashapp' | 'venmo' | 'paypal' | null>(null);
  const [summaryModal, setSummaryModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState<'cashapp' | 'venmo' | 'paypal' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update these with your payment URLs
  const paymentUrls = {
    cashapp: 'https://cash.app/$itsoxyye',
    venmo: 'https://venmo.com/bigmoneyoscar', // Update with your Venmo username
    paypal: 'https://paypal.me/OscarBerrigan', // Update with your PayPal username
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const processFile = async (selectedFile: File) => {
    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB.');
      return;
    }

    setError('');
    setFile(selectedFile);
    setSummary('');
    setExtractedText('');

    // Extract text from PDF
    try {
      setLoading(true);
      const text = await extractTextFromPDF(selectedFile);
      if (!text || text.trim().length === 0) {
        setError(
          'Could not extract text from PDF. The PDF might be scanned or image-based, which is not supported yet.'
        );
        setFile(null);
        return;
      }
      setExtractedText(text);
    } catch (err) {
      setError('Failed to extract text from PDF. Please try another file.');
      setFile(null);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    await processFile(droppedFile);
  };

  const handleSummarize = async () => {
    if (!extractedText) return;

    setLoading(true);
    setError('');
    setSummary('');

    try {
      // Show loading message if it takes a while
      const timeoutId = setTimeout(() => {
        if (loading) {
          // This will be handled by the UI showing "Processing..."
        }
      }, 2000);

      const result = await summarizeText(extractedText, summaryType);

      clearTimeout(timeoutId);

      if (result && result.trim().length > 0) {
        setSummary(result);
      } else {
        setError('Summary generation returned empty result. Please try again.');
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to generate summary.';
      setError(errorMessage);
      console.error('Summary generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSummary = (text: string): string => {
    if (!text) return '';

    // Remove section markers that might have leaked through
    text = text.replace(/##SECTION##/g, '');

    // First, handle bolded terms that might be stuck together
    // Split multiple **bolded terms** on the same line
    text = text.replace(/\*\*([^*]+)\*\*\s+\*\*([^*]+)\*\*/g, '**$1**\n**$2**');

    // Split lines that have a bolded term followed by another bolded term with text in between
    text = text.replace(/\*\*([^*]+)\*\*([^*]+?)\*\*([^*]+)\*\*/g, '**$1**$2\n**$3**');

    // Remove duplicates (sometimes summaries repeat content)
    const lines = text.split('\n');
    const seen = new Set<string>();
    const dedupedLines: string[] = [];

    for (const line of lines) {
      const normalized = line.trim().toLowerCase();
      if (normalized && !seen.has(normalized) && normalized.length > 10) {
        seen.add(normalized);
        dedupedLines.push(line.trim());
      } else if (!normalized) {
        dedupedLines.push('');
      }
    }

    let formatted = dedupedLines.join('\n');

    // Convert **bolded** terms to definition format if they're followed by text (not another bolded term)
    formatted = formatted.replace(
      /\*\*([^*]+)\*\*\s+([A-Z][^**]+?)(?=\n|$|\*\*)/g,
      (match, term, desc) => {
        // Only convert if it looks like a definition (term + description starting with capital)
        if (desc.length > 10 && !desc.match(/^\*\*/)) {
          return `• ${term}: ${desc.trim()}`;
        }
        return match;
      }
    );

    // Handle bolded terms that should be separate bullet points
    formatted = formatted.replace(/\*\*([^*]+)\*\*(?!\s*:)/g, '• $1:');

    // List of bullet characters to handle
    const bulletChars = ['•', '▪', '▫', '◦', '‣', '⁃'];

    // Handle different bullet types: add line breaks before bullets that aren't already on their own line
    bulletChars.forEach(bullet => {
      // Add line break before bullet if it's not at start of line
      formatted = formatted.replace(
        new RegExp(`([^\\n])(\\s*)(${bullet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+`, 'g'),
        '$1\n$3 '
      );
    });

    // Handle dash and asterisk bullets (only when they're standalone, not part of words)
    // Only match dash/asterisk if preceded by space/newline and followed by space
    // This avoids matching hyphens in words like "anti-coordination"
    formatted = formatted.replace(/([^\n\w])\s+([-*])\s+(?=[A-Z])/g, '$1\n$2 ');
    // Convert dash bullets at start of line only if followed by capital letter (not part of word)
    formatted = formatted.replace(/^([-*])\s+(?=[A-Z])/gm, '• '); // Convert dash bullets to bullet if at start

    // Ensure bullets at the start of lines have proper spacing
    bulletChars.forEach(bullet => {
      formatted = formatted.replace(
        new RegExp(`^\\s*(${bullet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*`, 'gm'),
        '$1 '
      );
    });

    // Handle numbered lists (1., 2., etc.)
    formatted = formatted.replace(/([^\n])\s+(\d+\.)\s+/g, '$1\n$2 ');

    // Split long lines that look like title + description (capital word followed by description)
    // Look for patterns like "Title Description text..." and split them
    formatted = formatted
      .split('\n')
      .map(line => {
        // If line is very long (over 80 chars) and has a pattern like "TitleWord AnotherWord..."
        // Try to split at natural break points
        const bulletStartPattern = new RegExp(`^[•▪▫◦‣⁃\\-*\\d]+\\.?`);

        // Split lines that have multiple definitions/concepts separated by periods
        const bulletCharsPattern =
          '[' +
          ['•', '▪', '▫', '◦', '‣', '⁃']
            .map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('') +
          '\\-*]';
        if (line.match(new RegExp(`^[${bulletCharsPattern}]\\s+.+\\.\\s+[A-Z]`))) {
          // Split at periods followed by space and capital letter
          line = line.replace(/\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:)/g, '.\n• $1');
        }

        if (line.length > 80 && !bulletStartPattern.test(line.trim())) {
          // Look for pattern: CapitalWord CapitalWord followed by lowercase (title ends, description begins)
          // Make sure we don't split on hyphens within words (like "anti-coordination")
          const titleDescMatch = line.match(/^([A-Z][^.]*?[A-Z][a-z]+)\s+([a-z].*)$/);
          if (titleDescMatch) {
            // Double-check we're not splitting a hyphenated word
            const titleEnd = titleDescMatch[1];
            const descStart = titleDescMatch[2];
            // If title ends with hyphen or description starts with lowercase after hyphen, don't split
            if (!titleEnd.endsWith('-') && !/^[a-z]+-/.test(descStart)) {
              return `${titleDescMatch[1]}.\n${titleDescMatch[2]}`;
            }
          }
          // Split at definitions that are concatenated (Term: definition. Term2: definition2)
          if (line.match(/[a-z]\.\s+[A-Z][a-z]+\s*:/)) {
            line = line.replace(/([a-z])\.\s+([A-Z][a-z]+\s*:)/g, '$1.\n• $2');
          }
          // Or split at common conjunctions if line is very long
          if (line.length > 120) {
            const splitAt = line.match(/\s+(?:and|or|but|Understand|Learn|Figure|Make)\s+/i);
            if (splitAt && splitAt.index && splitAt.index > 30) {
              return line.substring(0, splitAt.index) + '\n' + line.substring(splitAt.index + 1);
            }
          }
        }
        return line;
      })
      .join('\n');

    // Handle graph/list descriptions better - split on "and" and "or" when describing multiple items
    // Pattern: "intersection of: X and Y" or "determined by: A, B, and C"
    formatted = formatted.replace(
      /(intersection of|determined by|includes|consists of|comprises|contains):\s+([^.\n]+(?:and|or)\s+[^.\n]+)/gi,
      (match, intro, items) => {
        // Split items by "and" or "or", but be careful with commas
        const parts = items.split(/\s+(?:and|or)\s+/);
        if (parts.length > 1) {
          return `${intro}:\n${parts.map((p: string) => `• ${p.trim()}`).join('\n')}`;
        }
        return match;
      }
    );

    // Clean up awkward spacing in hyphenated terms (e.g., "upward - sloping" -> "upward-sloping")
    formatted = formatted.replace(
      /\s+-\s+(sloping|sloped|facing|moving|trending|rising|falling|shifting|based|bound|related|dependent|oriented|centered)/gi,
      '-$1'
    );

    // Clean up multiple consecutive newlines (max 2)
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Remove empty lines between bullets
    const escapedBullets = bulletChars.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    const bulletPattern = `[${escapedBullets}\\-*]`;
    formatted = formatted.replace(new RegExp(`\\n\\n([${bulletPattern}])`, 'g'), '\n$1');

    // Trim each line but preserve structure
    formatted = formatted
      .split('\n')
      .map(line => line.trim())
      .join('\n');

    // Remove duplicate consecutive lines
    const finalLines = formatted.split('\n');
    const finalDeduped: string[] = [];
    for (let i = 0; i < finalLines.length; i++) {
      const current = finalLines[i].trim();
      const next = finalLines[i + 1]?.trim();
      if (current && current !== next) {
        finalDeduped.push(current);
      } else if (!current && finalDeduped[finalDeduped.length - 1] !== '') {
        finalDeduped.push('');
      }
    }

    return finalDeduped.join('\n').trim();
  };

  const copyToClipboard = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      alert('Summary copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const reset = () => {
    setFile(null);
    setExtractedText('');
    setSummary('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Decorative Orbs */}
        <div className="absolute top-0 -left-20 w-96 h-96 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-20 w-96 h-96 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

        {/* Decorative Circles */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-sky-100 rounded-full mix-blend-multiply filter blur-2xl opacity-15"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-sky-200 rounded-full mix-blend-multiply filter blur-2xl opacity-15"></div>
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <div className="bg-sky-400 text-white px-6 py-3 rounded-2xl shadow-lg transform hover:scale-100 transition-transform hover:bg-sky-500 flex items-center justify-center gap-1">
              <img src="/download (1).png" alt="Quick Read Logo" className="h-14 w-auto" />
              <h1 className="text-5xl font-bold font-display mb-2 text-white">Quick Read</h1>
            </div>
          </div>
          <p className="text-xl text-gray-700 font-medium">
            Upload any PDF and instantly get a clean, concise summary ✨
          </p>
          <p className="text-sm text-gray-500 mt-2">Free, fast, and student-friendly</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8 mb-6 transform hover:shadow-3xl transition-shadow duration-300">
          {/* File Upload - Drag & Drop Area */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-4">
              Upload PDF (10MB Limit)
            </label>

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 md:p-16 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-sky-400 bg-sky-50 scale-[1.02]'
                    : 'border-gray-300 hover:border-sky-300 hover:bg-sky-50/50'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={loading}
                />

                <div className="flex flex-col items-center justify-center">
                  {/* Upload Icon */}
                  <div
                    className={`mb-6 transition-transform duration-300 ${
                      isDragging ? 'scale-110' : ''
                    }`}
                  >
                    <svg
                      className={`w-20 h-20 ${isDragging ? 'text-sky-500' : 'text-gray-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  {/* Text */}
                  <h3 className="text-2xl font-bold text-gray-700 mb-2">
                    {isDragging ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                  </h3>
                  <p className="text-gray-500 mb-4">or</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 bg-sky-400 hover:bg-sky-500 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    onClick={e => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    disabled={loading}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Browse Files
                  </button>
                  <p className="text-xs text-gray-400 mt-4">PDF files only, up to 10MB</p>
                </div>

                {/* Animated border effect when dragging */}
                {isDragging && (
                  <div className="absolute inset-0 rounded-2xl bg-sky-300/20 animate-pulse"></div>
                )}
              </div>
            ) : (
              <div className="border-2 border-sky-200 rounded-2xl p-6 bg-sky-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-md">
                      <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary Type Selection */}
          {extractedText && !summary && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-3">Summary Type</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="summaryType"
                    value="short"
                    checked={summaryType === 'short'}
                    onChange={e => setSummaryType(e.target.value as 'short' | 'detailed')}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-700">Short (~200 words)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="summaryType"
                    value="detailed"
                    checked={summaryType === 'detailed'}
                    onChange={e => setSummaryType(e.target.value as 'short' | 'detailed')}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-700">Detailed (~400 words)</span>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Summarize Button */}
          {extractedText && !summary && (
            <button
              onClick={handleSummarize}
              disabled={loading}
              className="w-full bg-sky-400 hover:bg-sky-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>✨ Summarize PDF</span>
                </>
              )}
            </button>
          )}

          {/* Loading State */}
          {loading && extractedText && !summary && (
            <div className="mt-6 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-sky-200 border-t-sky-400"></div>
              <p className="mt-4 text-base font-medium text-gray-700">Generating your summary...</p>
              <p className="mt-2 text-sm text-gray-500">
                This may take 10-30 seconds depending on PDF length
              </p>
            </div>
          )}

          {/* Summary Display */}
          {summary && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-sky-500">Summary</h2>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 text-sm bg-sky-100 hover:bg-sky-200 text-sky-600 font-semibold px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy
                </button>
              </div>
              <div
                className={`bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-lg overflow-hidden flex flex-col ${
                  summaryModal ? 'overflow-hidden' : ''
                }`}
                style={{ maxHeight: summaryModal ? 'none' : '120vh' }}
              >
                {/* Summary Title - Fixed at top */}
                <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-gray-200 relative">
                  <button
                    onClick={() => setSummaryModal(true)}
                    className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
                    title="Open summary in modal"
                  >
                    <svg
                      className="w-5 h-5 text-gray-500 group-hover:text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  </button>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 pr-12">
                    📄 {file ? `Summary: ${file.name.replace(/\.pdf$/i, '')}` : 'Document Summary'}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    A concise overview of the key concepts, topics, and important information from
                    your PDF document.
                  </p>
                </div>

                {/* Summary Content - Scrollable */}
                <div
                  className={`flex-1 px-8 py-6 ${
                    summaryModal ? 'overflow-hidden' : 'overflow-y-auto'
                  }`}
                >
                  <div className="space-y-6">
                    {formatSummary(summary)
                      .split('\n')
                      .filter(line => line.trim()) // Remove empty lines
                      .map((line, index, array) => {
                        // Check if line starts with a bullet (various bullet types)
                        const bulletChars = ['•', '▪', '▫', '◦', '‣', '⁃'];
                        const startsWithBullet = bulletChars.some(char =>
                          line.trim().startsWith(char)
                        );
                        // Only treat dash as bullet if followed by space and capital letter (not part of word)
                        const startsWithDash = /^[-\*]\s+[A-Z]/.test(line.trim());
                        const startsWithNumber = /^\d+\.\s/.test(line.trim());
                        const isBullet = startsWithBullet || startsWithDash || startsWithNumber;

                        // Get clean line text - only remove bullets if they're actual bullets (followed by space)
                        let cleanLine = line.trim();
                        // Remove bullet chars only if followed by space
                        if (
                          bulletChars.some(
                            c => cleanLine.startsWith(c + ' ') || cleanLine.startsWith(c)
                          )
                        ) {
                          cleanLine = cleanLine.replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '');
                        }
                        // Remove dash/asterisk only if followed by space and capital (bullet, not hyphen)
                        cleanLine = cleanLine.replace(/^[-\*]\s+(?=[A-Z])/, '');
                        // Remove numbered lists
                        cleanLine = cleanLine.replace(/^\d+\.\s*/, '');

                        // Detect if this line contains a term with definition (e.g., "Term: definition" or "Term - definition")
                        const definitionMatch = cleanLine.match(/^([^:—–-]+?)[:—–-]\s+(.+)$/);
                        const hasDefinition = !!definitionMatch;

                        // Detect section headers (longer lines, often all caps or have specific patterns)
                        const isSectionHeader =
                          !isBullet &&
                          ((cleanLine.length > 20 &&
                            cleanLine.length < 100 &&
                            (/^[A-Z][A-Z\s&:]+$/.test(cleanLine) || // All caps
                              /^(What|How|Why|The|Introduction|Summary|Key|Main|Advanced)/i.test(
                                cleanLine
                              ))) ||
                            (/:/.test(cleanLine) && cleanLine.split(':')[0].length < 50)); // Has colon and short first part

                        // Detect if this is a title (short line, starts with capital, or has title structure)
                        // But don't treat definition terms as titles
                        const isTitle =
                          isBullet &&
                          !hasDefinition &&
                          (cleanLine.length < 80 ||
                            /^[A-Z][^.]*[A-Z]/.test(cleanLine) ||
                            /^(The|A|An|How|What|Why|When|Where|Understanding|Introduction|Summary|Key|Main|Advanced|Game|Strategic)/i.test(
                              cleanLine
                            ));

                        // Check if next line is a description (follows a bullet/title, doesn't start with bullet)
                        const nextLine = index < array.length - 1 ? array[index + 1].trim() : '';
                        const nextIsBullet =
                          nextLine &&
                          (bulletChars.some(c => nextLine.startsWith(c)) ||
                            /^[-\*\d]/.test(nextLine));
                        const hasDescription =
                          !nextIsBullet &&
                          nextLine &&
                          (/^[a-z]/.test(nextLine) ||
                            /^(Understand|Learn|Figure|Make|Apply|Consider|Elicit|Introducing)/i.test(
                              nextLine
                            ));

                        // Check if previous line was a bullet (for spacing)
                        const prevIsBullet =
                          index > 0 &&
                          (bulletChars.some(c => array[index - 1].trim().startsWith(c)) ||
                            /^[-\*]\s+[A-Z]/.test(array[index - 1].trim()) ||
                            /^\d+\.\s/.test(array[index - 1].trim()));

                        // Check if previous line was a section header
                        const prevIsSectionHeader =
                          index > 0 &&
                          (() => {
                            const prevLine = array[index - 1].trim();
                            const prevClean = prevLine
                              .replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '')
                              .replace(/^[-\*]\s+(?=[A-Z])/, '')
                              .replace(/^\d+\.\s*/, '');
                            return (
                              prevClean.length > 20 &&
                              prevClean.length < 100 &&
                              (/^[A-Z][A-Z\s&:]+$/.test(prevClean) ||
                                /^(What|How|Why|The|Introduction|Summary|Key|Main|Advanced|Factor)/i.test(
                                  prevClean
                                ) ||
                                (/:/.test(prevClean) && prevClean.split(':')[0].length < 50))
                            );
                          })();

                        // Check if this is a description line (not a bullet, but follows a bullet)
                        const isDescription = !isBullet && prevIsBullet && !isSectionHeader;

                        // Check if previous bullet introduces a list (ends with colon)
                        const prevLineClean =
                          index > 0
                            ? (() => {
                                const prev = array[index - 1].trim();
                                return prev
                                  .replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '')
                                  .replace(/^[-\*]\s+(?=[A-Z])/, '')
                                  .replace(/^\d+\.\s*/, '');
                              })()
                            : '';
                        const prevBulletIntroducesList =
                          prevIsBullet && prevLineClean.endsWith(':');

                        // Check if this is a sub-bullet:
                        // 1. Previous bullet introduces a list (ends with colon), OR
                        // 2. Bullet follows another bullet without section header (nested content)
                        const isSubBullet =
                          isBullet &&
                          !isTitle &&
                          prevIsBullet &&
                          !prevIsSectionHeader &&
                          (prevBulletIntroducesList || !isSectionHeader);

                        // Check if we need a section divider (before section headers)
                        const needsSectionDivider = isSectionHeader && index > 0;

                        return (
                          <div key={index}>
                            {/* Section Divider - before section headers */}
                            {needsSectionDivider && (
                              <div className="my-6 border-t border-gray-200"></div>
                            )}

                            {/* Section Header */}
                            {isSectionHeader ? (
                              <h3 className="text-xl font-bold text-gray-900 mb-4 mt-6 first:mt-0 flex items-center gap-2">
                                <span className="text-2xl">✨</span>
                                {cleanLine}
                              </h3>
                            ) : (
                              <div
                                className={`${
                                  isBullet && isTitle
                                    ? 'ml-2 mb-3 flex items-start gap-3'
                                    : isSubBullet
                                    ? 'ml-8 mb-2 flex items-start gap-3'
                                    : isBullet
                                    ? 'ml-2 mb-2.5 flex items-start gap-3'
                                    : isDescription
                                    ? 'ml-8 mb-3 text-gray-600 text-sm leading-relaxed pl-3 border-l-3 border-sky-300 bg-sky-50/30 py-1 rounded-r'
                                    : 'mb-2.5 text-gray-700'
                                }`}
                              >
                                {isBullet && (
                                  <span
                                    className={`${
                                      isTitle
                                        ? 'text-sky-500 font-bold text-lg leading-none mt-1.5 flex-shrink-0'
                                        : isSubBullet
                                        ? 'text-sky-400 font-bold text-sm leading-none mt-1 flex-shrink-0'
                                        : 'text-sky-400 font-bold text-base leading-none mt-1 flex-shrink-0'
                                    }`}
                                  >
                                    {isSubBullet ? '◦' : '•'}
                                  </span>
                                )}
                                <span
                                  className={`${
                                    hasDefinition
                                      ? 'flex-1 text-base text-gray-800 leading-relaxed'
                                      : isBullet && isTitle
                                      ? 'flex-1 font-bold text-base text-gray-900 leading-relaxed'
                                      : isSubBullet
                                      ? 'flex-1 font-normal text-sm text-gray-700 leading-relaxed'
                                      : isBullet
                                      ? 'flex-1 font-medium text-base text-gray-800 leading-relaxed'
                                      : isDescription
                                      ? 'text-gray-600'
                                      : 'text-gray-700 leading-relaxed'
                                  }`}
                                >
                                  {hasDefinition ? (
                                    <>
                                      <span className="font-bold text-gray-900">
                                        {definitionMatch[1].trim()}
                                      </span>
                                      <span className="text-gray-700">: {definitionMatch[2]}</span>
                                    </>
                                  ) : (
                                    cleanLine || '\u00A0'
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              <button
                onClick={reset}
                className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
              >
                📄 Upload Another PDF
              </button>
            </div>
          )}
        </div>

        {/* Donation Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 text-center">
          <div className="mb-6">
            <p className="text-xl font-bold text-gray-800 mb-2">Did this save you time? 🎉</p>
            <p className="text-gray-600 font-medium">Support this tool with $1 ❤️</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <button
              onClick={() => setDonationModal('cashapp')}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 inline-flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              CashApp
            </button>
            <button
              onClick={() => setDonationModal('venmo')}
              className="bg-sky-400 hover:bg-sky-500 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 inline-flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              Venmo
            </button>
            <button
              onClick={() => setDonationModal('paypal')}
              className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 inline-flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              PayPal
            </button>
          </div>
        </div>

        {/* Summary Modal */}
        {summaryModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setSummaryModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex-shrink-0 px-8 py-6 border-b border-gray-200 flex items-center justify-between bg-sky-50">
                <h2 className="text-2xl font-bold text-gray-900">
                  📄 {file ? `Summary: ${file.name.replace(/\.pdf$/i, '')}` : 'Document Summary'}
                </h2>
                <button
                  onClick={() => setSummaryModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Modal Content - Scrollable (includes intro, summary, and conclusion) */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {/* Intro Section */}
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <p className="text-gray-600 text-sm leading-relaxed">
                    A concise overview of the key concepts, topics, and important information from
                    your PDF document.
                  </p>
                </div>

                {/* Summary Content */}
                <div className="space-y-6">
                  {formatSummary(summary)
                    .split('\n')
                    .filter(line => line.trim())
                    .map((line, index, array) => {
                      const bulletChars = ['•', '▪', '▫', '◦', '‣', '⁃'];
                      const startsWithBullet = bulletChars.some(char =>
                        line.trim().startsWith(char)
                      );
                      const startsWithDash = /^[-\*]\s+[A-Z]/.test(line.trim());
                      const startsWithNumber = /^\d+\.\s/.test(line.trim());
                      const isBullet = startsWithBullet || startsWithDash || startsWithNumber;

                      let cleanLine = line.trim();
                      if (
                        bulletChars.some(
                          c => cleanLine.startsWith(c + ' ') || cleanLine.startsWith(c)
                        )
                      ) {
                        cleanLine = cleanLine.replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '');
                      }
                      cleanLine = cleanLine.replace(/^[-\*]\s+(?=[A-Z])/, '');
                      cleanLine = cleanLine.replace(/^\d+\.\s*/, '');

                      const definitionMatch = cleanLine.match(/^([^:—–-]+?)[:—–-]\s+(.+)$/);
                      const hasDefinition = !!definitionMatch;

                      const isSectionHeader =
                        !isBullet &&
                        ((cleanLine.length > 20 &&
                          cleanLine.length < 100 &&
                          (/^[A-Z][A-Z\s&:]+$/.test(cleanLine) ||
                            /^(What|How|Why|The|Introduction|Summary|Key|Main|Advanced)/i.test(
                              cleanLine
                            ))) ||
                          (/:/.test(cleanLine) && cleanLine.split(':')[0].length < 50));

                      const isTitle =
                        isBullet &&
                        !hasDefinition &&
                        (cleanLine.length < 80 ||
                          /^[A-Z][^.]*[A-Z]/.test(cleanLine) ||
                          /^(The|A|An|How|What|Why|When|Where|Understanding|Introduction|Summary|Key|Main|Advanced|Game|Strategic)/i.test(
                            cleanLine
                          ));

                      const nextLine = index < array.length - 1 ? array[index + 1].trim() : '';
                      const nextIsBullet =
                        nextLine &&
                        (bulletChars.some(c => nextLine.startsWith(c)) ||
                          /^[-\*\d]/.test(nextLine));
                      const hasDescription =
                        !nextIsBullet &&
                        nextLine &&
                        (/^[a-z]/.test(nextLine) ||
                          /^(Understand|Learn|Figure|Make|Apply|Consider|Elicit|Introducing)/i.test(
                            nextLine
                          ));

                      const prevIsBullet =
                        index > 0 &&
                        (bulletChars.some(c => array[index - 1].trim().startsWith(c)) ||
                          /^[-\*]\s+[A-Z]/.test(array[index - 1].trim()) ||
                          /^\d+\.\s/.test(array[index - 1].trim()));

                      const prevIsSectionHeader =
                        index > 0 &&
                        (() => {
                          const prevLine = array[index - 1].trim();
                          const prevClean = prevLine
                            .replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '')
                            .replace(/^[-\*]\s+(?=[A-Z])/, '')
                            .replace(/^\d+\.\s*/, '');
                          return (
                            prevClean.length > 20 &&
                            prevClean.length < 100 &&
                            (/^[A-Z][A-Z\s&:]+$/.test(prevClean) ||
                              /^(What|How|Why|The|Introduction|Summary|Key|Main|Advanced|Factor)/i.test(
                                prevClean
                              ) ||
                              (/:/.test(prevClean) && prevClean.split(':')[0].length < 50))
                          );
                        })();

                      const isDescription = !isBullet && prevIsBullet && !isSectionHeader;

                      // Check if previous bullet introduces a list (ends with colon)
                      const prevLineClean =
                        index > 0
                          ? (() => {
                              const prev = array[index - 1].trim();
                              return prev
                                .replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '')
                                .replace(/^[-\*]\s+(?=[A-Z])/, '')
                                .replace(/^\d+\.\s*/, '');
                            })()
                          : '';
                      const prevBulletIntroducesList = prevIsBullet && prevLineClean.endsWith(':');

                      // Check if we're in a sub-bullet chain (looking backwards to see if we started from a colon)
                      let inSubBulletChain = false;
                      if (isBullet && prevIsBullet && !prevIsSectionHeader) {
                        // Walk backwards to find if we started from a bullet ending with colon
                        for (let i = index - 1; i >= 0; i--) {
                          const checkLine = array[i].trim();
                          const checkClean = checkLine
                            .replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '')
                            .replace(/^[-\*]\s+(?=[A-Z])/, '')
                            .replace(/^\d+\.\s*/, '');

                          const checkIsBullet =
                            bulletChars.some(c => checkLine.startsWith(c)) ||
                            /^[-\*]\s+[A-Z]/.test(checkLine) ||
                            /^\d+\.\s/.test(checkLine);

                          if (!checkIsBullet) break;
                          if (checkClean.endsWith(':')) {
                            inSubBulletChain = true;
                            break;
                          }
                          // Stop if we hit a section header or clear break
                          if (i > 0) {
                            const beforeClean = array[i - 1]
                              .trim()
                              .replace(new RegExp(`^[•▪▫◦‣⁃]\\s*`), '')
                              .replace(/^[-\*]\s+(?=[A-Z])/, '')
                              .replace(/^\d+\.\s*/, '');
                            const beforeIsHeader =
                              beforeClean.length > 20 &&
                              beforeClean.length < 100 &&
                              (/^[A-Z][A-Z\s&:]+$/.test(beforeClean) ||
                                /^(What|How|Why|The|Introduction|Summary|Key|Main|Advanced|Factor)/i.test(
                                  beforeClean
                                ));
                            if (beforeIsHeader) break;
                          }
                        }
                      }

                      // Check if this is a sub-bullet:
                      // 1. Previous bullet introduces a list (ends with colon), OR
                      // 2. We're in a sub-bullet chain, OR
                      // 3. Bullet follows another bullet without section header (nested content)
                      const isSubBullet =
                        isBullet &&
                        !isTitle &&
                        prevIsBullet &&
                        !prevIsSectionHeader &&
                        (prevBulletIntroducesList || inSubBulletChain);
                      const needsSectionDivider = isSectionHeader && index > 0;

                      return (
                        <div key={index}>
                          {needsSectionDivider && !isSectionHeader && (
                            <div className="my-6 border-t border-gray-200"></div>
                          )}

                          {isSectionHeader ? (
                            <h3 className="text-xl font-bold text-gray-900 mb-4 mt-6 first:mt-0 flex items-center gap-2">
                              <span className="text-2xl">✨</span>
                              {cleanLine}
                            </h3>
                          ) : (
                            <div
                              className={`${
                                isBullet && isTitle
                                  ? 'ml-2 mb-3 flex items-start gap-3'
                                  : isSubBullet
                                  ? 'ml-8 mb-2 flex items-start gap-3'
                                  : isBullet
                                  ? 'ml-2 mb-2.5 flex items-start gap-3'
                                  : isDescription
                                  ? 'ml-8 mb-3 text-gray-600 text-sm leading-relaxed pl-3 border-l-3 border-indigo-300 bg-indigo-50/30 py-1 rounded-r'
                                  : 'mb-2.5 text-gray-700'
                              }`}
                            >
                              {isBullet && (
                                <span
                                  className={`${
                                    isTitle
                                      ? 'text-indigo-600 font-bold text-lg leading-none mt-1.5 flex-shrink-0'
                                      : isSubBullet
                                      ? 'text-indigo-400 font-bold text-sm leading-none mt-1 flex-shrink-0'
                                      : 'text-indigo-500 font-bold text-base leading-none mt-1 flex-shrink-0'
                                  }`}
                                >
                                  {isSubBullet ? '◦' : '•'}
                                </span>
                              )}
                              <span
                                className={`${
                                  hasDefinition
                                    ? 'flex-1 text-base text-gray-800 leading-relaxed'
                                    : isBullet && isTitle
                                    ? 'flex-1 font-bold text-base text-gray-900 leading-relaxed'
                                    : isBullet
                                    ? 'flex-1 font-medium text-base text-gray-800 leading-relaxed'
                                    : isDescription
                                    ? 'text-gray-600'
                                    : 'text-gray-700 leading-relaxed'
                                }`}
                              >
                                {hasDefinition ? (
                                  <>
                                    <span className="font-bold text-gray-900">
                                      {definitionMatch[1].trim()}
                                    </span>
                                    <span className="text-gray-700">: {definitionMatch[2]}</span>
                                  </>
                                ) : (
                                  cleanLine || '\u00A0'
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {donationModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setDonationModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in zoom-in-95 duration-300 border-4 border-white/20"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3
                  className={`text-3xl font-bold flex items-center gap-2 ${
                    donationModal === 'cashapp'
                      ? 'text-green-500'
                      : donationModal === 'venmo'
                      ? 'text-sky-400'
                      : 'text-blue-800'
                  }`}
                >
                  {donationModal === 'cashapp' && 'CashApp'}
                  {donationModal === 'venmo' && 'Venmo'}
                  {donationModal === 'paypal' && 'PayPal'}
                </h3>
                <button
                  onClick={() => setDonationModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>
              <p className="text-gray-700 mb-6 text-center font-medium">
                Scan this QR code with your{' '}
                <span
                  className={`font-bold ${
                    donationModal === 'cashapp'
                      ? 'text-green-500'
                      : donationModal === 'venmo'
                      ? 'text-sky-400'
                      : 'text-blue-800'
                  }`}
                >
                  {donationModal === 'cashapp'
                    ? 'CashApp'
                    : donationModal === 'venmo'
                    ? 'Venmo'
                    : 'PayPal'}
                </span>{' '}
                app to donate
              </p>
              <div className="flex justify-center mb-6 bg-gray-50 p-6 rounded-2xl border-2 border-gray-200">
                <QRCode
                  value={paymentUrls[donationModal]}
                  size={256}
                  level="H"
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  viewBox={`0 0 256 256`}
                />
              </div>
              <p className="text-sm text-gray-600 text-center mb-4 font-medium">
                Or copy this link:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={paymentUrls[donationModal]}
                  className={`flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none transition-colors ${
                    donationModal === 'cashapp'
                      ? 'focus:border-green-500'
                      : donationModal === 'venmo'
                      ? 'focus:border-sky-400'
                      : 'focus:border-blue-800'
                  }`}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentUrls[donationModal]);
                    setCopiedPayment(donationModal);
                    setTimeout(() => setCopiedPayment(null), 2000);
                  }}
                  className={`${
                    copiedPayment === donationModal
                      ? 'bg-gray-400 cursor-default'
                      : donationModal === 'cashapp'
                      ? 'bg-green-500 hover:bg-green-600'
                      : donationModal === 'venmo'
                      ? 'bg-sky-400 hover:bg-sky-500'
                      : 'bg-blue-800 hover:bg-blue-900'
                  } text-white px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105`}
                  disabled={copiedPayment === donationModal}
                >
                  {copiedPayment === donationModal ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
