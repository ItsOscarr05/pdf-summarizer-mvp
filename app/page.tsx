'use client'

import { useState, useRef } from 'react'
import { extractTextFromPDF } from '@/lib/pdfExtractor'
import { summarizeText } from '@/lib/summarizer'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState<string>('')
  const [summary, setSummary] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [summaryType, setSummaryType] = useState<'short' | 'detailed'>('short')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB.')
      return
    }

    setError('')
    setFile(selectedFile)
    setSummary('')
    setExtractedText('')

    // Extract text from PDF
    try {
      setLoading(true)
      const text = await extractTextFromPDF(selectedFile)
      if (!text || text.trim().length === 0) {
        setError('Could not extract text from PDF. The PDF might be scanned or image-based, which is not supported yet.')
        setFile(null)
        return
      }
      setExtractedText(text)
    } catch (err) {
      setError('Failed to extract text from PDF. Please try another file.')
      setFile(null)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async () => {
    if (!extractedText) return

    setLoading(true)
    setError('')
    setSummary('')

    try {
      const result = await summarizeText(extractedText, summaryType)
      setSummary(result)
    } catch (err) {
      setError('Failed to generate summary. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!summary) return
    try {
      await navigator.clipboard.writeText(summary)
      alert('Summary copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const reset = () => {
    setFile(null)
    setExtractedText('')
    setSummary('')
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PDF Summarizer
          </h1>
          <p className="text-lg text-gray-600">
            Upload any PDF and instantly get a clean, concise summary.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-6">
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF (max 10MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
              disabled={loading}
            />
            {file && (
              <div className="mt-3 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={reset}
                  className="text-sm text-red-600 hover:text-red-700"
                  disabled={loading}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Summary Type Selection */}
          {extractedText && !summary && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Summary Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="summaryType"
                    value="short"
                    checked={summaryType === 'short'}
                    onChange={(e) => setSummaryType(e.target.value as 'short' | 'detailed')}
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
                    onChange={(e) => setSummaryType(e.target.value as 'short' | 'detailed')}
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                'Summarize PDF'
              )}
            </button>
          )}

          {/* Loading State */}
          {loading && extractedText && !summary && (
            <div className="mt-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-600">Extracting text and generating summary...</p>
            </div>
          )}

          {/* Summary Display */}
          {summary && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900">Summary</h2>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {summary}
                </p>
              </div>
              <button
                onClick={reset}
                className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Upload Another PDF
              </button>
            </div>
          )}
        </div>

        {/* Donation Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <p className="text-gray-700 mb-4">
            Did this save you time? Support this tool with $1 ❤️
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://ko-fi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <span>☕ Ko-fi</span>
            </a>
            <a
              href="https://buymeacoffee.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <span>☕ Buy Me a Coffee</span>
            </a>
            <a
              href="https://paypal.me"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <span>💳 PayPal</span>
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            This is a micro-tool experiment. Full AssignmentAI coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

