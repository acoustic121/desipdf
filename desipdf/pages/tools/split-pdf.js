import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'split-pdf')

export default function SplitPdf() {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('all')
  const [range, setRange] = useState('')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handle = async () => {
    if (!file) { const t = (await import('react-hot-toast')).default; t.error('Upload a PDF'); return }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mode', mode)
    formData.append('range', range)
    await convert('/api/convert/split-pdf', formData, 'split-pages.zip')
  }

  return (
    <>
      <Head><title>Split PDF – DesiPDF</title></Head>
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" />
        {file && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Split Mode</label>
              <div className="space-y-2">
                {[['all','Extract all pages (one PDF per page)'],['range','Extract specific pages']].map(([v,l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={v} checked={mode===v} onChange={()=>setMode(v)} className="text-blue-600"/>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{l}</span>
                  </label>
                ))}
              </div>
            </div>
            {mode==='range' && (
              <div>
                <label className="label">Page Ranges</label>
                <input type="text" value={range} onChange={e=>setRange(e.target.value)} placeholder="e.g. 1-3, 5, 7-9" className="input-field"/>
              </div>
            )}
            <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">
              {loading ? '⏳ Splitting…' : '✂️ Split PDF'}
            </button>
          </div>
        )}
      </ToolLayout>
    </>
  )
}
