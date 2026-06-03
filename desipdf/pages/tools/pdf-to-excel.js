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
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    await convert('/api/convert/pdf-to-excel', fd, file.name.replace('.pdf', '.xlsx'))
  }
  return (<>
    <Head><title>PDF to Excel – DesiPDF</title></Head>
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
