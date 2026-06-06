import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'word-to-pdf')
export default function WordToPdf() {
  const [file, setFile] = useState(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { loadMammoth } = await import('../../utils/clientLoader')
      const mammoth = await loadMammoth()
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      const text = result.value || '(No text content found)'

      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontSize = 12
      const margin = 50
      const pageWidth = 595.28
      const pageHeight = 841.89
      const lineHeight = fontSize * 1.5
      const maxWidth = pageWidth - margin * 2
      const lines = []

      for (const paragraph of text.split('\n')) {
        const words = paragraph.split(' ')
        let line = ''
        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word
          const testWidth = font.widthOfTextAtSize(testLine, fontSize)
          if (testWidth > maxWidth && line) {
            lines.push(line)
            line = word
          } else {
            line = testLine
          }
        }
        if (line) lines.push(line)
        lines.push('')
      }

      let page = pdfDoc.addPage([pageWidth, pageHeight])
      let y = pageHeight - margin

      for (const line of lines) {
        if (y < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        if (line) {
          page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) })
        }
        y -= lineHeight
      }

      const pdfBytes = await pdfDoc.save()
      return pdfBytes
    }, file.name.replace(/\.docx?$/, '.pdf'))
  }
  return (<>
    <ToolSeoHead tool={tool} />
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".doc,.docx" label="Drop your Word document here" sublabel="Supports .doc and .docx files" />
      {file && <div className="mt-6"><button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Converting…':'📄 Convert to PDF'}</button></div>}
    </ToolLayout>
  </>)
}
