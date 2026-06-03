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
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    await convert('/api/convert/excel-to-pdf', fd, file.name.replace(/\.xlsx?$/, '.pdf'))
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
