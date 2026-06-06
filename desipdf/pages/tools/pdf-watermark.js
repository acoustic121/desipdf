import ToolSeoHead from '../../components/ToolSeoHead'
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
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file || !text.trim()) return
    await runClientSide(async () => {
      const { PDFDocument, rgb, StandardFonts, degrees } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const pages = pdfDoc.getPages()
      
      const op = parseFloat(opacity || '30') / 100
      const r = parseInt(color.slice(1, 3), 16) / 255
      const g = parseInt(color.slice(3, 5), 16) / 255
      const b = parseInt(color.slice(5, 7), 16) / 255

      pages.forEach((page) => {
        const { width, height } = page.getSize()
        const fontSize = Math.min(width, height) * 0.12
        const textWidth = font.widthOfTextAtSize(text, fontSize)

        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: height / 2 - fontSize / 2,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity: op,
          rotate: degrees(45),
        })
      })

      const outBytes = await pdfDoc.save()
      return outBytes
    }, `watermarked-${file.name}`)
  }
  return (<>
    <ToolSeoHead tool={tool} />
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
