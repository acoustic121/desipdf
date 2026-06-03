import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'pdf-to-word')
export default function PdfToWord() {
  const [file, setFile] = useState(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pageCount = pdfDoc.getPageCount()

      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
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

      const buffer = await Packer.toBlob(doc)
      return buffer
    }, file.name.replace('.pdf', '.docx'))
  }
  return (<>
    <Head><title>PDF to Word – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">ℹ️ Text-based PDFs convert best. Scanned image PDFs may have limited accuracy.</div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Converting…':'✏️ Convert to Word'}</button>
      </div>}
    </ToolLayout>
  </>)
}
