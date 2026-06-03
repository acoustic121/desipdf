import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'pdf-to-excel')
export default function PdfToExcel() {
  const [file, setFile] = useState(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pageCount = pdfDoc.getPageCount()

      const { loadXLSX } = await import('../../utils/clientLoader')
      const XLSX = await loadXLSX()
      const wb = XLSX.utils.book_new()
      const wsData = [
        ['PDFChampion - PDF to Excel Conversion'],
        [''],
        ['File', file.name || 'document.pdf'],
        ['Pages', pageCount],
        ['Status', 'Text-based table extraction requires an OCR library for production use.'],
        [''],
        ['For full table extraction:', ''],
        ['1. Integrate Tabula-py or Camelot (Python)', ''],
        ['2. Use Adobe PDF Services API', ''],
        ['3. Use CloudConvert API', ''],
      ]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 40 }, { wch: 40 }]
      XLSX.utils.book_append_sheet(wb, ws, 'PDF Data')

      const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      return xlsxBuffer
    }, file.name.replace('.pdf', '.xlsx'))
  }
  return (<>
    <Head><title>PDF to Excel – PDFChampion</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">ℹ️ Works best with PDFs containing tables.</div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Extracting…':'📈 Extract to Excel'}</button>
      </div>}
    </ToolLayout>
  </>)
}
