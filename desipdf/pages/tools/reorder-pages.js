import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'reorder-pages')
export default function ReorderPages() {
  const [file, setFile] = useState(null)
  const [newOrder, setNewOrder] = useState('')
  const [pageCount, setPageCount] = useState(null)
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handleFileSelect = async (f) => {
    setFile(f)
    if (f) { try { const { PDFDocument } = await import('pdf-lib'); const buf = await f.arrayBuffer(); const pdf = await PDFDocument.load(buf); const c = pdf.getPageCount(); setPageCount(c); setNewOrder(Array.from({length:c},(_,i)=>i+1).join(', ')) } catch {} }
  }
  const handle = async () => {
    if (!file || !newOrder.trim()) return
    const fd = new FormData(); fd.append('file', file); fd.append('order', newOrder)
    await convert('/api/convert/reorder-pages', fd, `reordered-${file.name}`)
  }
  return (<>
    <Head><title>Reorder Pages – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={handleFileSelect} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        {pageCount && <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-sm text-blue-700 dark:text-blue-300">📄 PDF has <strong>{pageCount}</strong> pages</div>}
        <div>
          <label className="label">New Page Order</label>
          <input type="text" value={newOrder} onChange={e=>setNewOrder(e.target.value)} placeholder="e.g. 3, 1, 2, 4" className="input-field"/>
          <p className="text-xs text-gray-400 mt-1">Enter page numbers in the new order, separated by commas.</p>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Reordering…':'↕️ Reorder Pages'}</button>
      </div>}
    </ToolLayout>
  </>)
}
