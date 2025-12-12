# PDF Summarizer MVP

A lightweight, zero-cost web tool that allows students to upload a PDF and instantly receive a clean, concise summary.

## Features

- 📄 **PDF Upload** - Upload PDF files up to 10MB
- ✂️ **Text Extraction** - Client-side PDF text extraction using pdf.js
- 🤖 **AI Summarization** - Powered by HuggingFace Inference API (free tier)
- 📱 **Mobile-First** - Responsive design that works on all devices
- 📋 **Copy to Clipboard** - Easy sharing of summaries
- 💝 **Donation Support** - Optional $1 donation buttons

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **pdf.js** - Client-side PDF parsing
- **HuggingFace Inference API** - Free AI summarization

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to link your project

### Option 2: Deploy via GitHub

1. Push your code to a GitHub repository

2. Go to [vercel.com](https://vercel.com)

3. Click "New Project" and import your repository

4. Vercel will automatically detect Next.js and deploy

### Environment Variables

No environment variables are required for the MVP! The HuggingFace Inference API is used without authentication for the free tier.

**Note:** If you hit rate limits, you can:
- Add a `HUGGINGFACE_API_KEY` environment variable to your Vercel project
- Update `lib/summarizer.ts` to use the API key in headers

## Configuration

### Updating Donation Links

Edit the donation buttons in `app/page.tsx`:

```tsx
<a href="https://ko-fi.com/YOUR_USERNAME" ...>
<a href="https://buymeacoffee.com/YOUR_USERNAME" ...>
<a href="https://paypal.me/YOUR_USERNAME" ...>
```

### Adjusting File Size Limit

Change the `MAX_FILE_SIZE` constant in `app/page.tsx`:

```tsx
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
```

### Changing Summary Length

Modify the `maxLength` and `minLength` parameters in `lib/summarizer.ts`:

```tsx
const maxLength = type === 'short' ? 200 : 400
const minLength = type === 'short' ? 100 : 200
```

## Limitations (MVP)

- **Scanned PDFs**: Not supported (image-based PDFs require OCR)
- **Rate Limits**: HuggingFace free tier has rate limits (can add API key for higher limits)
- **Large PDFs**: Files over 10MB are rejected
- **No History**: Summaries are not saved (client-side only)

## Troubleshooting

### "Model is loading" Error

HuggingFace free tier models can take 20-30 seconds to wake up if not used recently. Wait a moment and try again.

### "Rate limit exceeded"

The free tier has rate limits. Options:
1. Wait a minute and try again
2. Add a HuggingFace API key (free at huggingface.co)

### PDF text extraction fails

- Ensure the PDF contains actual text (not just images)
- Try a different PDF file
- Some PDFs with unusual encoding may not work

## Future Enhancements

- Key points extraction
- Flashcard generator
- Export to DOCX/PDF
- Summary history with login
- Chrome extension
- OCR support for scanned PDFs

## License

MIT

## Support

Did this save you time? Support this tool with $1 ❤️

---

Built as part of the "$1 Challenge" - validating that software skills are valuable and people will pay for time-saving tools.

