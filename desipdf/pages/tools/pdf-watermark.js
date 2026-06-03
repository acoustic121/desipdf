import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'pdf-watermark')
export default function PdfWatermark() {
  const [file, setFile] = useState(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState('30')
  const [color, setColor] = useState('#ff0000')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file || !text.trim()) return
    const fd = new FormData(); fd.append('file', file); fd.append('text', text); fd.append('opacity', opacity); fd.append('color', color)
    await convert('/api/convert/pdf-watermark', fd, `watermarked-${file.name}`)
  }
  return (<>
    <Head><title>Watermark PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div><label className="label">Watermark Text</label><input type="text" value={text} onChange={e=>setText(e.target.value)} placeholder="e.g. CONFIDENTIAL" className="input-field"/></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Opacity ({opacity}%)</label><input type="range" min="5" max="80" value={opacity} onChange={e=>setOpacity(e.target.value)} className="w-full accent-blue-500"/></div>
          <div><label className="label">Color</label><input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer"/></div>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Adding watermark…':'💧 Add Watermark'}</button>
      </div>}
    </ToolLayout>
  </>)
}
