import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'excel-to-pdf')
export default function ExcelToPdf() {
  const [file, setFile] = useState(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { loadXLSX } = await import('../../utils/clientLoader')
      const XLSX = await loadXLSX()
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Courier)
      const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold)
      const fontSize = 9
      const margin = 40

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (data.length === 0) continue

        const pageWidth = 841.89
        const pageHeight = 595.28
        let page = pdfDoc.addPage([pageWidth, pageHeight])
        let y = pageHeight - margin

        page.drawText(`Sheet: ${sheetName}`, {
          x: margin, y, size: 12, font: boldFont, color: rgb(0.1, 0.3, 0.7),
        })
        y -= 20

        for (const row of data) {
          if (y < margin) {
            page = pdfDoc.addPage([pageWidth, pageHeight])
            y = pageHeight - margin
          }
          const rowText = row.map((cell) => String(cell).slice(0, 20).padEnd(20)).join(' | ')
          page.drawText(rowText.slice(0, 100), {
            x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1),
          })
          y -= fontSize * 1.5
        }
      }

      const pdfBytes = await pdfDoc.save()
      return pdfBytes
    }, file.name.replace(/\.xlsx?$/, '.pdf'))
  }
  return (<>
    <Head><title>Excel to PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".xls,.xlsx" label="Drop your Excel file here" sublabel="Supports .xls and .xlsx" />
      {file && <div className="mt-6"><button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Converting…':'📊 Convert to PDF'}</button></div>}
    </ToolLayout>
  </>)
}
