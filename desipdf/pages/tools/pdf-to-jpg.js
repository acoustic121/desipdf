import SeoHead from '../../components/SeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
import { downloadBlob } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { supabase } from '../../utils/supabase'

const tool = TOOLS.find((t) => t.id === 'pdf-to-jpg')

export default function PdfToJpg() {
  const [file, setFile] = useState(null)
  const [dpi, setDpi] = useState('150')
  const [loading, setLoading] = useState(false)
  const { showLimitModal, setShowLimitModal } = useConvert()

  const handleConvert = async () => {
    if (!file) return toast.error('Please upload a PDF first')
    setLoading(true)
    const toastId = toast.loading('Converting PDF to JPG…')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const formData = new FormData()
      formData.append('file', file)
      formData.append('dpi', dpi)

      const res = await fetch('/api/convert/pdf-to-jpg', {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (res.status === 429) {
        toast.error('Daily limit reached.', { id: toastId })
        setShowLimitModal(true)
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Conversion failed')
      }

      const wasTruncated = res.headers.get('X-Pages-Truncated') === 'true'
      const total = res.headers.get('X-Pages-Total')
      const converted = res.headers.get('X-Pages-Converted')

      const blob = await res.blob()
      downloadBlob(blob, file.name.replace('.pdf', '-pages.zip'))

      if (wasTruncated) {
        toast.success(`Done! Converted ${converted} of ${total} pages. Upgrade to Premium for all pages.`, { id: toastId, duration: 6000 })
      } else {
        toast.success('Done! Downloading your images.', { id: toastId })
      }
    } catch (err) {
      toast.error(err.message, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SeoHead
        title="PDF to JPG Online – Convert PDF Pages to Images Free"
        description="Convert PDF to JPG images online for free. Each PDF page becomes a high-quality JPG image. No software needed. Fast and secure conversion."
        keywords="pdf to jpg, convert pdf to image, pdf to jpeg, pdf to png, pdf pages to images online free"
        canonical="/tools/pdf-to-jpg"
      />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" />
        {file && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Image Quality (DPI)</label>
              <select value={dpi} onChange={(e) => setDpi(e.target.value)} className="input-field">
                <option value="72">72 DPI – Web (fastest)</option>
                <option value="150">150 DPI – Medium (recommended)</option>
                <option value="300">300 DPI – Print quality (slowest)</option>
              </select>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              ⚡ Free plan converts up to <strong>10 pages</strong>. Upgrade to Premium for up to 200 pages.
            </div>
            <button onClick={handleConvert} disabled={loading} className="btn-primary w-full justify-center py-3.5">
              {loading ? '⏳ Converting…' : '🖼️ Convert to JPG'}
            </button>
          </div>
        )}
      </ToolLayout>
    </>
  )
}
