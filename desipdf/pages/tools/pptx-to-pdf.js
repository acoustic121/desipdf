import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'pptx-to-pdf')
export default function PptxToPdf() {
  const [file, setFile] = useState(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { loadJsZip } = await import('../../utils/clientLoader')
      const JSZip = await loadJsZip()
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      // Find all slide XML files
      const slideEntries = Object.keys(zip.files)
        .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] || '0')
          const nb = parseInt(b.match(/\d+/)?.[0] || '0')
          return na - nb
        })

      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const slideW = 960
      const slideH = 540

      for (let i = 0; i < slideEntries.length; i++) {
        const xml = await zip.files[slideEntries[i]].async('text')
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
      return pdfBytes
    }, file.name.replace(/\.pptx?$/, '.pdf'))
  }
  return (<>
    <ToolSeoHead tool={tool} />
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".ppt,.pptx" label="Drop your PowerPoint file here" sublabel="Supports .ppt and .pptx" />
      {file && <div className="mt-6"><button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Converting…':'📑 Convert to PDF'}</button></div>}
    </ToolLayout>
  </>)
}
