import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'rotate-pdf')
export default function RotatePdf() {
  const [file, setFile] = useState(null)
  const [angle, setAngle] = useState('90')
  const [pages, setPages] = useState('all')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file); fd.append('angle', angle); fd.append('pages', pages)
    await convert('/api/convert/rotate-pdf', fd, `rotated-${file.name}`)
  }
  return (<>
    <Head><title>Rotate PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div>
          <label className="label">Rotation Angle</label>
          <div className="grid grid-cols-3 gap-2">
            {['90','180','270'].map(a => (
              <button key={a} onClick={() => setAngle(a)} className={`py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${angle===a?'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {a}° {a==='90'?'↻':a==='180'?'↕':'↺'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Apply to</label>
          <select value={pages} onChange={e=>setPages(e.target.value)} className="input-field">
            <option value="all">All pages</option>
            <option value="odd">Odd pages only</option>
            <option value="even">Even pages only</option>
          </select>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Rotating…':'🔄 Rotate PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
