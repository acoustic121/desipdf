import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import { TOOLS } from '../../utils/constants'
import Link from 'next/link'

const tool = TOOLS.find((t) => t.id === 'ocr-pdf')

export default function OcrPdf() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState('')
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState('eng')

  const isPdf = file?.name?.toLowerCase().endsWith('.pdf')

  const handleOcr = async () => {
    if (!file) return toast.error('Please upload an image file')
    if (isPdf) return toast.error('Please convert your PDF to JPG first using the PDF to JPG tool below')

    setLoading(true)
    setResult('')
    setProgress(0)
    const toastId = toast.loading('Loading OCR engine…')

    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(lang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      toast.loading('Running OCR…', { id: toastId })
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      setResult(text)
      toast.success('OCR complete!', { id: toastId })
    } catch (err) {
      toast.error(err.message || 'OCR failed', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  const copyText = () => {
    navigator.clipboard.writeText(result)
    toast.success('Copied to clipboard!')
  }

  const downloadTxt = () => {
    const blob = new Blob([result], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ocr-result.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <ToolSeoHead tool={tool} />
      <ToolLayout tool={tool}>
        <div className="space-y-4">

          {/* Info banner */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            ℹ️ OCR works on <strong>image files</strong> (JPG, PNG). Have a PDF? First use{' '}
            <Link href="/tools/pdf-to-jpg" className="underline font-semibold">PDF to JPG</Link>{' '}
            to convert it, then run OCR on the image.
          </div>

          <FileUpload
            onFilesSelect={setFile}
            accept=".jpg,.jpeg,.png,.webp,.bmp,.tiff"
            label="Drop a scanned image here"
            sublabel="Supports JPG, PNG, WebP, BMP, TIFF"
          />

          {/* PDF warning */}
          {isPdf && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              ⚠️ PDFs are not supported directly. Please{' '}
              <Link href="/tools/pdf-to-jpg" className="underline font-semibold">convert to JPG first</Link>{' '}
              then run OCR on the image.
            </div>
          )}

          {file && !isPdf && (
            <>
              <div>
                <label className="label">OCR Language</label>
                <select value={lang} onChange={(e) => setLang(e.target.value)} className="input-field">
                  <option value="eng">English</option>
                  <option value="hin">Hindi (हिन्दी)</option>
                  <option value="tam">Tamil (தமிழ்)</option>
                  <option value="tel">Telugu (తెలుగు)</option>
                  <option value="ben">Bengali (বাংলা)</option>
                  <option value="mar">Marathi (मराठी)</option>
                  <option value="guj">Gujarati (ગુજરાતી)</option>
                  <option value="eng+hin">English + Hindi</option>
                </select>
              </div>

              {loading && progress > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Recognizing text…</span><span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <button onClick={handleOcr} disabled={loading} className="btn-primary w-full justify-center py-3.5">
                {loading ? '⏳ Running OCR…' : '🔍 Extract Text (OCR)'}
              </button>
            </>
          )}

          {result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Extracted Text</label>
                <div className="flex gap-2">
                  <button onClick={copyText} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Copy</button>
                  <button onClick={downloadTxt} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Download .txt</button>
                </div>
              </div>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={12}
                className="input-field font-mono text-sm resize-y"
              />
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-600 text-center">
            🔒 OCR runs in your browser using Tesseract.js. Your file never leaves your device.
          </div>
        </div>
      </ToolLayout>
    </>
  )
}
