import ToolSeoHead from '../../components/ToolSeoHead'
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
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handleFileSelect = async (f) => {
    setFile(f)
    if (f) { try { const { PDFDocument } = await import('pdf-lib'); const buf = await f.arrayBuffer(); const pdf = await PDFDocument.load(buf); const c = pdf.getPageCount(); setPageCount(c); setNewOrder(Array.from({length:c},(_,i)=>i+1).join(', ')) } catch {} }
  }
  const handle = async () => {
    if (!file || !newOrder.trim()) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(arrayBuffer)
      const totalPages = srcDoc.getPageCount()

      const parsedOrder = newOrder.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n))
      const indices = parsedOrder.filter((n) => n >= 1 && n <= totalPages).map((n) => n - 1)

      const newDoc = await PDFDocument.create()
      const copied = await newDoc.copyPages(srcDoc, indices)
      copied.forEach((p) => newDoc.addPage(p))

      const outBytes = await newDoc.save()
      return outBytes
    }, `reordered-${file.name}`)
  }
  return (<>
    <ToolSeoHead tool={tool} />
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
