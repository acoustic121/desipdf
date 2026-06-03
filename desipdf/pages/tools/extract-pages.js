import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'extract-pages')
export default function ExtractPages() {
  const [file, setFile] = useState(null)
  const [range, setRange] = useState('')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file || !range.trim()) return
    const fd = new FormData(); fd.append('file', file); fd.append('range', range)
    await convert('/api/convert/extract-pages', fd, 'extracted-pages.pdf')
  }
  return (<>
    <Head><title>Extract Pages – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div>
          <label className="label">Pages to Extract</label>
          <input type="text" value={range} onChange={e=>setRange(e.target.value)} placeholder="e.g. 1, 3-5, 8" className="input-field"/>
          <p className="text-xs text-gray-400 mt-1">Separate pages with commas. Use dash for ranges.</p>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Extracting…':'📋 Extract Pages'}</button>
      </div>}
    </ToolLayout>
  </>)
}
