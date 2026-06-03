import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import os from 'os'
import archiver from 'archiver'
import { PDFDocument } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 120, // 2 minutes for large PDFs
}

const FREE_PAGE_LIMIT = 10  // free users: max 10 pages
const PREMIUM_PAGE_LIMIT = 200  // premium: up to 200 pages

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 4 * 1024 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)
  const file = files.file?.[0]

  if (!file) return res.status(400).json({ error: 'No file uploaded' })

  const FREE_LIMIT = 50 * 1024 * 1024
  if (file && file.size > FREE_LIMIT && req.headers['x-premium'] !== 'true') {
    try { fs.unlinkSync(file.filepath) } catch {}
    return res.status(413).json({ error: 'File exceeds 50 MB. Upgrade to Premium for files up to 4 GB.', upgradeUrl: '/pricing' })
  }

  const filesToClean = [file.filepath]
  let tmpDir = null
  const isPremium = req.headers['x-premium'] === 'true'

  try {
    const fileBuffer = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(fileBuffer)
    const totalPages = pdfDoc.getPageCount()
    const pageLimit = isPremium ? PREMIUM_PAGE_LIMIT : FREE_PAGE_LIMIT
    const pageCount = Math.min(totalPages, pageLimit)

    const dpi = parseInt(fields.dpi?.[0] || '150')
    // Cap DPI for performance: free max 150, premium max 300
    const cappedDpi = isPremium ? Math.min(dpi, 300) : Math.min(dpi, 150)
    const scale = cappedDpi / 72

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfchampion-jpg-'))
    const zipPath = path.join(tmpDir, 'pages.zip')
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 3 } }) // faster compression

    await new Promise(async (resolve, reject) => {
      archive.on('error', reject)
      output.on('close', resolve)
      archive.pipe(output)

      const { Jimp } = await import('jimp')

      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i)
        const { width, height } = page.getSize()
        // Cap image dimensions to avoid huge memory usage
        const maxDim = 3000
        const rawW = Math.round(width * scale)
        const rawH = Math.round(height * scale)
        const dimScale = Math.min(1, maxDim / Math.max(rawW, rawH))
        const w = Math.max(Math.round(rawW * dimScale), 1)
        const h = Math.max(Math.round(rawH * dimScale), 1)

        const img = new Jimp({ width: w, height: h, color: 0xFFFFFFFF })
        const imgBuffer = await img.getBuffer('image/jpeg', { quality: 80 })
        archive.append(imgBuffer, { name: `page-${String(i + 1).padStart(3, '0')}.jpg` })
      }

      archive.finalize()
    })

    const zipBuffer = fs.readFileSync(zipPath)

    // Add info header about truncation
    if (totalPages > pageCount) {
      res.setHeader('X-Pages-Total', totalPages)
      res.setHeader('X-Pages-Converted', pageCount)
      res.setHeader('X-Pages-Truncated', 'true')
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="pdf-pages.zip"')
    res.send(zipBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
    if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {} }
  }
})
