import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 4 * 1024 * 1024 * 1024 })
  const [, files] = await form.parse(req)
  const file = files.file?.[0]
  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium
  const FREE_LIMIT = 50 * 1024 * 1024
  if (file && file.size > FREE_LIMIT && req.headers['x-premium'] !== 'true') {
    filesToClean?.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
    return res.status(413).json({ error: 'File exceeds 50 MB. Upgrade to Premium for files up to 4 GB.', upgradeUrl: '/pricing' })
  }


  try {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(file.filepath)

    // Extract slide XML files to get text content
    const slideEntries = zip.getEntries()
      .filter((e) => e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const na = parseInt(a.entryName.match(/\d+/)?.[0] || '0')
        const nb = parseInt(b.entryName.match(/\d+/)?.[0] || '0')
        return na - nb
      })

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const slideW = 960
    const slideH = 540

    for (let i = 0; i < slideEntries.length; i++) {
      const xml = slideEntries[i].getData().toString('utf8')
      // Extract text from XML tags
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g)].map((m) => m[1]).filter(Boolean)
      const titleText = texts[0] || `Slide ${i + 1}`
      const bodyTexts = texts.slice(1)

      const page = pdfDoc.addPage([slideW, slideH])

      // Background
      page.drawRectangle({ x: 0, y: 0, width: slideW, height: slideH, color: rgb(0.05, 0.1, 0.3) })
      // Slide number badge
      page.drawText(`${i + 1}`, { x: slideW - 40, y: slideH - 30, size: 14, font, color: rgb(1, 1, 1, 0.4) })
      // Title
      page.drawText(titleText.slice(0, 60), { x: 50, y: slideH - 80, size: 28, font, color: rgb(1, 1, 1) })
      // Body lines
      let y = slideH - 140
      for (const line of bodyTexts.slice(0, 8)) {
        page.drawText(line.slice(0, 80), { x: 50, y, size: 16, font: bodyFont, color: rgb(0.85, 0.9, 1) })
        y -= 30
        if (y < 60) break
      }
    }

    if (pdfDoc.getPageCount() === 0) {
      // Fallback single page
      const page = pdfDoc.addPage([960, 540])
      page.drawText('PowerPoint file processed', { x: 50, y: 270, size: 20, font, color: rgb(0, 0, 0) })
    }

    const pdfBytes = await pdfDoc.save()
    

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"')
    res.send(Buffer.from(pdfBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})