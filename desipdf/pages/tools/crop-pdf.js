import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'crop-pdf')
export default function CropPdf() {
  const [file, setFile] = useState(null)
  const [margins, setMargins] = useState({top:'0',right:'0',bottom:'0',left:'0'})
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const setM = (side, val) => setMargins(m => ({...m, [side]: val}))
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const top    = parseFloat(margins.top || '0')
      const right  = parseFloat(margins.right || '0')
      const bottom = parseFloat(margins.bottom || '0')
      const left   = parseFloat(margins.left || '0')

      pdfDoc.getPages().forEach((page) => {
        const { x, y, width, height } = page.getCropBox()
        page.setCropBox(
          x + left,
          y + bottom,
          Math.max(width  - left - right,  10),
          Math.max(height - top  - bottom, 10),
        )
      })
      const outBytes = await pdfDoc.save()
      return outBytes
    }, `cropped-${file.name}`)
  }
  return (<>
    <ToolSeoHead tool={tool} />
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Enter margin to crop in points (1 pt ≈ 0.35 mm). Positive values trim inward.</p>
        <div className="grid grid-cols-2 gap-3">
          {['top','right','bottom','left'].map(side => (
            <div key={side}><label className="label capitalize">{side} (pt)</label><input type="number" min="0" max="300" value={margins[side]} onChange={e=>setM(side,e.target.value)} className="input-field"/></div>
          ))}
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Cropping…':'✂️ Crop PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
