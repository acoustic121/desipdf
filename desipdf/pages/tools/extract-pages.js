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
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file || !range.trim()) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const { parsePageRange } = await import('../../utils/helpers')
      const arrayBuffer = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(arrayBuffer)
      const totalPages = srcDoc.getPageCount()

      const pageNums = parsePageRange(range, totalPages)
      if (pageNums.length === 0) throw new Error('No valid pages in range')

      const newDoc = await PDFDocument.create()
      const indices = pageNums.map((n) => n - 1)
      const copied = await newDoc.copyPages(srcDoc, indices)
      copied.forEach((p) => newDoc.addPage(p))

      const outBytes = await newDoc.save()
      return outBytes
    }, 'extracted-pages.pdf')
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
