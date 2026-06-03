import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

// NOTE: Extracting text from PDF and generating a real .docx requires
// additional libraries. This uses pdf-lib (metadata) + docx package for output.
// For production, integrate a cloud PDF extraction API for best results.

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
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(srcBytes)
    const pageCount = pdfDoc.getPageCount()

    // Build a basic Word document with page count info
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('Converted from PDF')],
          }),
          new Paragraph({
            children: [new TextRun({ text: `Original PDF had ${pageCount} page(s).`, break: 1 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Note: For full text extraction from scanned PDFs, OCR processing is required.', italics: true, color: '888888' })],
          }),
        ],
      }],
    })

    const buffer = await Packer.toBuffer(doc)
    

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', 'attachment; filename="converted.docx"')
    res.send(buffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})