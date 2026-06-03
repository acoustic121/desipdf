import SeoHead from '../../components/SeoHead'
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
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    const arr = Array.isArray(files) ? files : [files].filter(Boolean)
    if (!arr.length) return
    const fd = new FormData()
    arr.forEach(f => fd.append('files', f))
    fd.append('pageSize', pageSize)
    await convert('/api/convert/jpg-to-pdf', fd, 'converted.pdf')
  }
  return (<>
    <SeoHead
      title="JPG to PDF Online – Convert Images to PDF Free"
      description="Convert JPG, PNG and other images to PDF online for free. Combine multiple images into one PDF document. No installation, works on mobile and desktop."
      keywords="jpg to pdf, image to pdf, convert jpg to pdf online, png to pdf, photos to pdf free"
      canonical="/tools/jpg-to-pdf"
    />
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
