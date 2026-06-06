import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'jpg-to-pdf')
export default function JpgToPdf() {
  const [files, setFiles] = useState([])
  const [pageSize, setPageSize] = useState('A4')
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    const arr = Array.isArray(files) ? files : [files].filter(Boolean)
    if (!arr.length) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.create()

      const PAGE_SIZES = {
        A4: [595.28, 841.89],
        Letter: [612, 792],
        A3: [841.89, 1190.55],
      }
      const [pgW, pgH] = PAGE_SIZES[pageSize] || PAGE_SIZES.A4

      for (const file of arr) {
        const arrayBuffer = await file.arrayBuffer()
        const imgBytes = new Uint8Array(arrayBuffer)
        const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50

        let img
        try {
          img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
        } catch {
          try { img = await pdfDoc.embedPng(imgBytes) } catch { img = await pdfDoc.embedJpg(imgBytes) }
        }

        const page = pdfDoc.addPage([pgW, pgH])
        const dims = img.size()
        const scale = Math.min(pgW / dims.width, pgH / dims.height)
        page.drawImage(img, {
          x: (pgW - dims.width * scale) / 2,
          y: (pgH - dims.height * scale) / 2,
          width: dims.width * scale,
          height: dims.height * scale,
        })
      }

      const pdfBytes = await pdfDoc.save()
      return pdfBytes
    }, 'converted.pdf')
  }
  return (<>
    <ToolSeoHead tool={tool} />
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFiles} accept=".jpg,.jpeg,.png,.webp" multiple label="Drop images here" sublabel="Multiple images → placed in order" />
      {Array.isArray(files) && files.length > 0 && <div className="mt-6 space-y-4">
        <div>
          <label className="label">Page Size</label>
          <select value={pageSize} onChange={e=>setPageSize(e.target.value)} className="input-field">
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="Letter">US Letter (8.5 × 11 in)</option>
            <option value="A3">A3 (297 × 420 mm)</option>
          </select>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Creating PDF…':'📄 Create PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
