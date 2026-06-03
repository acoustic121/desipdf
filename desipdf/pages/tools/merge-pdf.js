import SeoHead from '../../components/SeoHead'
import ToolLayout from '../../components/ToolLayout'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { hasReachedLimit, incrementUsage } from '../../utils/usageLimit'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { DocumentIcon, XMarkIcon, ArrowsUpDownIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const tool = TOOLS.find((t) => t.id === 'merge-pdf')

// ── Drag-sortable file list ────────────────────────────────────────────────────
function FileItem({ file, index, total, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 group">
      {/* Order badge */}
      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>

      <DocumentIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>

      {/* Move buttons */}
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          title="Move up"
          className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-400 hover:text-blue-600 disabled:opacity-20 transition-all"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => onMoveDown(index)}
          disabled={index === total - 1}
          title="Move down"
          className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-400 hover:text-blue-600 disabled:opacity-20 transition-all"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-500 transition-colors"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function MergePdf() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [showLimitModal, setShowLimitModal] = useState(false)

  // ── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Only PDF files are accepted')
      return
    }
    setFiles((prev) => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  })

  // ── Reorder helpers ─────────────────────────────────────────────────────────
  const moveUp = (i) => {
    if (i === 0) return
    setFiles((prev) => {
      const arr = [...prev]
      ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
      return arr
    })
  }

  const moveDown = (i) => {
    setFiles((prev) => {
      if (i === prev.length - 1) return prev
      const arr = [...prev]
      ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
      return arr
    })
  }

  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))

  // ── Browser-side merge using pdf-lib ────────────────────────────────────────
  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error('Please upload at least 2 PDF files')
      return
    }

    // Check daily usage limit
    if (hasReachedLimit()) {
      setShowLimitModal(true)
      return
    }

    setLoading(true)
    const toastId = toast.loading('Merging PDFs in your browser…')

    try {
      // Dynamically import pdf-lib so it's only loaded when needed
      const { PDFDocument } = await import('pdf-lib')

      const merged = await PDFDocument.create()

      for (let i = 0; i < files.length; i++) {
        setProgress(`Processing file ${i + 1} of ${files.length}…`)

        // Read file as ArrayBuffer in the browser
        const arrayBuffer = await files[i].arrayBuffer()
        const doc = await PDFDocument.load(arrayBuffer)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach((page) => merged.addPage(page))
      }

      setProgress('Saving merged PDF…')
      const mergedBytes = await merged.save()

      // Trigger download directly in the browser — no server needed!
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'merged.pdf'
      a.click()
      URL.revokeObjectURL(url)

      // Record usage
      incrementUsage()

      toast.success(`✅ Merged ${files.length} PDFs successfully!`, { id: toastId, duration: 4000 })
      setProgress('')
    } catch (err) {
      console.error(err)
      toast.error('Failed to merge: ' + err.message, { id: toastId })
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <>
      <SeoHead
        title="Merge PDF Files Online – Combine PDFs Free"
        description="Merge multiple PDF files into one document online for free. No upload needed — files stay in your browser. Fast, secure, and easy to use."
        keywords="merge pdf, combine pdf, join pdf files, merge pdf online free, combine multiple pdf"
        canonical="/tools/merge-pdf"
      />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}

      <ToolLayout tool={tool}>
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`drop-zone ${isDragActive ? 'drop-zone-active' : ''} mb-4`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <CloudArrowUpIcon className={`h-14 w-14 ${isDragActive ? 'text-blue-500' : 'text-gray-400'} transition-colors`} />
            <div>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
                {isDragActive ? 'Drop your PDFs here' : 'Drop PDFs to merge'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Select multiple PDFs — merged in order shown below</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">PDF • No size limit • Processed in your browser</p>
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <ArrowsUpDownIcon className="h-4 w-4 text-blue-500" />
                {files.length} file{files.length > 1 ? 's' : ''} · {(totalSize / 1024 / 1024).toFixed(1)} MB total
              </p>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Clear all
              </button>
            </div>

            {files.map((file, i) => (
              <FileItem
                key={`${file.name}-${i}`}
                file={file}
                index={i}
                total={files.length}
                onRemove={removeFile}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
              />
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 mb-4 flex items-start gap-2">
          <span className="text-base">🔒</span>
          <span><strong>100% Private:</strong> Your files are processed entirely in your browser and never uploaded to any server.</span>
        </div>

        {/* Progress indicator */}
        {loading && progress && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400 mb-4 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {progress}
          </div>
        )}

        {/* Merge button */}
        {files.length >= 2 && (
          <button
            onClick={handleMerge}
            disabled={loading}
            className="btn-primary w-full justify-center py-3.5"
          >
            {loading ? '⏳ Merging…' : `🔗 Merge ${files.length} PDFs`}
          </button>
        )}

        {files.length === 1 && (
          <p className="text-center text-sm text-gray-400 mt-4">Add at least one more PDF to enable merging</p>
        )}
      </ToolLayout>
    </>
  )
}
