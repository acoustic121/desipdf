import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import AdmZip from 'adm-zip'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER })
  const [fields, files] = await form.parse(req)
  const filesToClean = []
  const file = files.file?.[0]
  
  if (file) {
    filesToClean.push(file.filepath)
  }
  
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const filename = file.originalFilename || 'unlocked-file'
  const ext = filename.split('.').pop().toLowerCase()

  try {
    let outBytes
    let contentType = 'application/octet-stream'

    if (ext === 'pdf') {
      const srcBytes = fs.readFileSync(file.filepath)
      let pdfDoc
      try {
        // Load WITHOUT ignoreEncryption — this resolves the encryption context.
        // If the PDF has no open-password (owner-only lock), this succeeds.
        // Saving afterwards without encryption options strips all restrictions.
        pdfDoc = await PDFDocument.load(srcBytes)
      } catch (e) {
        const msg = e.message?.toLowerCase() || ''
        if (msg.includes('password') || msg.includes('encrypt') || msg.includes('decrypt')) {
          return res.status(400).json({ 
            error: 'This PDF is encrypted with an open-file password and cannot be unlocked without it. Use the standard "Unlock PDF" tool if you know the password.' 
          })
        }
        throw e
      }

      // Save without re-applying any encryption → strips all owner restrictions permanently.
      outBytes = await pdfDoc.save()
      contentType = 'application/pdf'

    } else if (ext === 'docx') {
      const zip = new AdmZip(file.filepath)
      const settingsEntry = zip.getEntry('word/settings.xml')
      if (settingsEntry) {
        let xml = settingsEntry.getData().toString('utf8')
        // Strip document protection tag
        xml = xml.replace(/<w:documentProtection[^>]*\/>/g, '')
        xml = xml.replace(/<w:documentProtection[^>]*>.*?<\/w:documentProtection>/g, '')
        zip.updateFile('word/settings.xml', Buffer.from(xml, 'utf8'))
      }
      outBytes = zip.toBuffer()
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    } else if (ext === 'xlsx') {
      const zip = new AdmZip(file.filepath)
      
      // Workbook protection (e.g. structure protection)
      const workbookEntry = zip.getEntry('xl/workbook.xml')
      if (workbookEntry) {
        let xml = workbookEntry.getData().toString('utf8')
        xml = xml.replace(/<workbookProtection[^>]*\/>/g, '')
        xml = xml.replace(/<workbookProtection[^>]*>.*?<\/workbookProtection>/g, '')
        zip.updateFile('xl/workbook.xml', Buffer.from(xml, 'utf8'))
      }

      // Worksheet protection (sheet protection)
      const entries = zip.getEntries()
      entries.forEach(entry => {
        if (/^xl\/worksheets\/sheet\d+\.xml$/.test(entry.entryName)) {
          let xml = entry.getData().toString('utf8')
          xml = xml.replace(/<sheetProtection[^>]*\/>/g, '')
          xml = xml.replace(/<sheetProtection[^>]*>.*?<\/sheetProtection>/g, '')
          zip.updateFile(entry.entryName, Buffer.from(xml, 'utf8'))
        }
      })
      outBytes = zip.toBuffer()
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    } else {
      // Pass-through for other files (fallback support)
      outBytes = fs.readFileSync(file.filepath)
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="unlocked_${filename}"`)
    res.send(Buffer.from(outBytes))

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: `Failed to unlock file: ${err.message}` })
  } finally {
    filesToClean.forEach((p) => {
      try {
        fs.unlinkSync(p)
      } catch {}
    })
  }
})
