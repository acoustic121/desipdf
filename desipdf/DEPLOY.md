# PDFChampion – Deploy to Vercel in 5 Minutes

## 1. Install dependencies

```bash
cd pdfchampion
npm install
```

## 2. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## 3. Deploy to Vercel (free)

```bash
# Install Vercel CLI (one time)
npm install -g vercel

# Deploy
vercel

# Follow prompts → framework: Next.js → deploy
```

Or use the Vercel dashboard:
1. Push this folder to GitHub
2. Go to https://vercel.com → New Project → Import from GitHub
3. Vercel auto-detects Next.js and deploys

## 4. Add your domain

In Vercel dashboard → Project → Settings → Domains → Add `pdfchampion.com`

Then in your domain registrar, point:
- `A` record → `76.76.21.21`
- `CNAME www` → `cname.vercel-dns.com`

## 5. Environment variables (optional)

Copy `.env.local.example` → `.env.local` and fill in values.
Add the same keys in Vercel → Settings → Environment Variables.

---

## File structure

```
pdfchampion/
├── pages/
│   ├── index.js          # Homepage
│   ├── about.js
│   ├── faq.js
│   ├── privacy-policy.js
│   ├── tools/            # 14 tool pages
│   └── api/convert/      # 14 serverless API routes
├── components/           # Reusable UI
├── styles/globals.css    # Tailwind + custom CSS
├── utils/                # Constants, helpers, Zustand store
├── locales/              # 7 language JSON files
└── package.json
```

## Tools included

| Tool | Page | API |
|------|------|-----|
| PDF to JPG | /tools/pdf-to-jpg | /api/convert/pdf-to-jpg |
| JPG to PDF | /tools/jpg-to-pdf | /api/convert/jpg-to-pdf |
| Merge PDF | /tools/merge-pdf | /api/convert/merge-pdf |
| Split PDF | /tools/split-pdf | /api/convert/split-pdf |
| Compress PDF | /tools/compress-pdf | /api/convert/compress-pdf |
| Rotate PDF | /tools/rotate-pdf | /api/convert/rotate-pdf |
| Extract Pages | /tools/extract-pages | /api/convert/extract-pages |
| Reorder Pages | /tools/reorder-pages | /api/convert/reorder-pages |
| Add Watermark | /tools/pdf-watermark | /api/convert/pdf-watermark |
| Word to PDF | /tools/word-to-pdf | /api/convert/word-to-pdf |
| PDF to Word | /tools/pdf-to-word | /api/convert/pdf-to-word |
| Excel to PDF | /tools/excel-to-pdf | /api/convert/excel-to-pdf |
| PDF to Excel | /tools/pdf-to-excel | /api/convert/pdf-to-excel |
| PPT to PDF | /tools/pptx-to-pdf | /api/convert/pptx-to-pdf |

## Total cost: ₹0

Only pay for the domain (~₹500/year). Everything else is free on Vercel.
