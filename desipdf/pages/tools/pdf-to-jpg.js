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
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handleConvert = async () => {
    if (!file) return toast.error('Please upload a PDF first')
    await runClientSide(async () => {
      const { loadPdfJs, loadJsZip } = await import('../../utils/clientLoader')
      const pdfjs = await loadPdfJs()
      const JSZip = await loadJsZip()

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      const totalPages = pdf.numPages

      // Check premium status to determine page limits
      let isPremium = false
      try {
        const flag = localStorage.getItem('desipdf_premium')
        if (flag === 'true') isPremium = true
      } catch {}

      const FREE_PAGE_LIMIT = 10
      const PREMIUM_PAGE_LIMIT = 200
      const pageLimit = isPremium ? PREMIUM_PAGE_LIMIT : FREE_PAGE_LIMIT
      const pageCount = Math.min(totalPages, pageLimit)

      const requestedDpi = parseInt(dpi || '150')
      const cappedDpi = isPremium ? Math.min(requestedDpi, 300) : Math.min(requestedDpi, 150)
      const scale = cappedDpi / 72

      const zip = new JSZip()

      for (let i = 0; i < pageCount; i++) {
        const page = await pdf.getPage(i + 1)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({ canvasContext: context, viewport }).promise

        // Convert canvas to blob
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
        zip.file(`page-${String(i + 1).padStart(3, '0')}.jpg`, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })

      if (totalPages > pageCount) {
        toast.success(`Done! Converted ${pageCount} of ${totalPages} pages. Upgrade to Premium for all pages.`, { duration: 6000 })
      }

      return zipBlob
    }, file.name.replace('.pdf', '-pages.zip'))
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
