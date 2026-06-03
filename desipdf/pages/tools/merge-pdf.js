import SeoHead from '../../components/SeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'merge-pdf')

export default function MergePdf() {
  const [files, setFiles] = useState([])
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handleMerge = async () => {
    const arr = Array.isArray(files) ? files : [files].filter(Boolean)
    if (arr.length < 2) { const toast = (await import('react-hot-toast')).default; toast.error('Upload at least 2 PDFs'); return }
    const formData = new FormData()
    arr.forEach((f) => formData.append('files', f))
    await convert('/api/convert/merge-pdf', formData, 'merged.pdf')
  }

  return (
    <>
      <SeoHead
        title="Merge PDF Files Online – Combine PDFs Free"
        description="Merge multiple PDF files into one document online for free. No installation required. Fast, secure, and easy to use. Combine PDFs in any order instantly."
        keywords="merge pdf, combine pdf, join pdf files, merge pdf online free, combine multiple pdf"
        canonical="/tools/merge-pdf"
      />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFiles} accept=".pdf" multiple label="Drop PDFs to merge" sublabel="Select multiple PDFs — merged in order" />
        {Array.isArray(files) && files.length >= 2 && (
          <button onClick={handleMerge} disabled={loading} className="btn-primary w-full justify-center py-3.5 mt-6">
            {loading ? '⏳ Merging…' : '🔗 Merge PDFs'}
          </button>
        )}
      </ToolLayout>
    </>
  )
}
