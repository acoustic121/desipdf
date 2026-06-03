import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'repair-pdf')
export default function RepairPdf() {
  const [file, setFile] = useState(null)
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    await convert('/api/convert/repair-pdf', fd, `repaired-${file.name}`)
  }
  return (<>
    <Head><title>Repair PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" label="Drop damaged PDF here" sublabel="We'll try to recover and rebuild the file structure"/>
      {file && <div className="mt-6 space-y-4">
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400">🔧 DesiPDF will reload and rebuild the PDF structure to fix common corruption issues.</div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Repairing…':'🔧 Repair PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
