# Deployment Guide

## Quick Deploy to Vercel

### Step 1: Prepare Your Code

1. Make sure all files are committed to git (if using GitHub) or ready to upload

### Step 2: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign up/login (free account)
2. Click "Add New..." → "Project"
3. Import your Git repository OR
4. Use "Deploy" to upload files directly

### Step 3: Configure Build Settings

Vercel will auto-detect Next.js. The defaults should work:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (auto-detected)
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `npm install` (auto-detected)

### Step 4: Deploy

Click "Deploy" and wait 2-3 minutes. Your app will be live!

### Step 5: Update Donation Links

1. Edit `app/page.tsx`
2. Replace the placeholder URLs with your actual:
   - Ko-fi: `https://ko-fi.com/YOUR_USERNAME`
   - Buy Me a Coffee: `https://buymeacoffee.com/YOUR_USERNAME`
   - PayPal: `https://paypal.me/YOUR_USERNAME`
3. Redeploy (Vercel auto-deploys on git push, or manually trigger)

## Alternative: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

## Custom Domain (Optional)

1. In Vercel dashboard, go to your project → Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions

## Environment Variables (Optional)

For now, no environment variables are needed. If you want to add HuggingFace API key later:

1. Go to Vercel project → Settings → Environment Variables
2. Add `HUGGINGFACE_API_KEY` (if implementing server-side API route)

## Troubleshooting

### Build Fails

- Check that all dependencies are in `package.json`
- Ensure Node.js version is 18+ in Vercel settings

### PDF Extraction Not Working

- Check browser console for errors
- Ensure pdf.js worker CDN is accessible
- Try a different PDF file

### Summarization Rate Limits

- HuggingFace free tier has limits
- Wait 1-2 minutes between requests
- Consider adding a loading message about rate limits

## Post-Deployment Checklist

- [ ] Test PDF upload
- [ ] Test summarization
- [ ] Test on mobile device
- [ ] Update donation links with your actual URLs
- [ ] Share the link!

## Cost

**$0/month** - Everything runs on free tiers:

- Vercel: Free hosting (generous limits)
- HuggingFace: Free Inference API (rate-limited but sufficient for MVP)
