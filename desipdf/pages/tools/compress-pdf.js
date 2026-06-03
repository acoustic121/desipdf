import SeoHead from '../../components/SeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'compress-pdf')

export default function CompressPdf() {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('medium')
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      })
      return compressedBytes
    }, `compressed-${file.name}`)
  }

  return (
    <>
      <SeoHead
        title="Compress PDF Online – Reduce PDF File Size Free"
        description="Compress PDF files online for free. Reduce PDF size without losing quality. Fast, secure, and no installation needed. Perfect for email and WhatsApp sharing."
        keywords="compress pdf, reduce pdf size, shrink pdf, pdf compressor online free, reduce pdf file size"
        canonical="/tools/compress-pdf"
      />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" />
        {file && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Compression Level</label>
              <select value={quality} onChange={e=>setQuality(e.target.value)} className="input-field">
                <option value="low">Low compression (best quality)</option>
                <option value="medium">Medium compression (recommended)</option>
                <option value="high">High compression (smallest size)</option>
              </select>
            </div>
            <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">
              {loading ? '⏳ Compressing…' : '🗜️ Compress PDF'}
            </button>
          </div>
        )}
      </ToolLayout>
    </>
  )
}
