import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'page-numbers')
export default function PageNumbers() {
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('bottom-center')
  const [startFrom, setStartFrom] = useState('1')
  const [fontSize, setFontSize] = useState('12')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file); fd.append('position', position); fd.append('startFrom', startFrom); fd.append('fontSize', fontSize)
    await convert('/api/convert/page-numbers', fd, `numbered-${file.name}`)
  }
  return (<>
    <Head><title>Page Numbers – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div>
          <label className="label">Position</label>
          <div className="grid grid-cols-3 gap-2">
            {['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'].map(pos => (
              <button key={pos} onClick={()=>setPosition(pos)} className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition-all ${position===pos?'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300'}`}>{pos.replace('-',' ')}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Start from page</label><input type="number" min="1" value={startFrom} onChange={e=>setStartFrom(e.target.value)} className="input-field"/></div>
          <div><label className="label">Font size (pt)</label><input type="number" min="8" max="24" value={fontSize} onChange={e=>setFontSize(e.target.value)} className="input-field"/></div>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Adding numbers…':'🔢 Add Page Numbers'}</button>
      </div>}
    </ToolLayout>
  </>)
}
