import Head from 'next/head'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import { TOOLS } from '../../utils/constants'
import { downloadBlob } from '../../utils/helpers'

const tool = TOOLS.find((t) => t.id === 'scan-to-pdf')

export default function ScanToPdf() {
  const [captures, setCaptures] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      videoRef.current.srcObject = stream
      streamRef.current = stream
      setStreaming(true)
    } catch {
      toast.error('Camera access denied. Please allow camera permission.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setStreaming(false)
  }

  const capture = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCaptures((prev) => [...prev, dataUrl])
    toast.success(`Page ${captures.length + 1} captured!`)
  }

  const removeCapture = (i) => setCaptures(captures.filter((_, idx) => idx !== i))

  const handleCreatePdf = async () => {
    if (captures.length === 0) return toast.error('Capture at least one page first')
    setLoading(true)
    const toastId = toast.loading(`Creating PDF from ${captures.length} page(s)…`)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.create()

      const pgW = 595.28
      const pgH = 841.89

      for (let i = 0; i < captures.length; i++) {
        const base64 = captures[i].split(',')[1]
        const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const img = await pdfDoc.embedJpg(imgBytes)

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
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
      downloadBlob(pdfBlob, 'scanned-document.pdf')
      toast.success('PDF created!', { id: toastId })
      stopCamera()
      setCaptures([])
    } catch (err) {
      toast.error(err.message || 'Failed to create PDF', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Scan to PDF – DesiPDF</title></Head>
      <ToolLayout tool={tool}>
        <div className="space-y-5">
          {/* Camera preview */}
          <div className={`rounded-2xl overflow-hidden bg-gray-900 ${streaming ? 'block' : 'hidden'}`}>
            <video ref={videoRef} autoPlay playsInline className="w-full max-h-64 object-cover" />
          </div>

          {!streaming ? (
            <button onClick={startCamera} className="btn-primary w-full justify-center py-4 text-base">
              📷 Start Camera
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={capture} className="btn-primary justify-center py-3.5">
                📸 Capture Page
              </button>
              <button onClick={stopCamera} className="btn-secondary justify-center py-3.5">
                Stop Camera
              </button>
            </div>
          )}

          {/* Captures preview */}
          {captures.length > 0 && (
            <div>
              <p className="label mb-2">{captures.length} page(s) captured</p>
              <div className="grid grid-cols-3 gap-2">
                {captures.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt={`Page ${i + 1}`} className="w-full h-24 object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                    <button onClick={() => removeCapture(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {captures.length > 0 && (
            <button onClick={handleCreatePdf} disabled={loading} className="btn-primary w-full justify-center py-3.5">
              {loading ? '⏳ Creating PDF…' : `📄 Create PDF (${captures.length} page${captures.length > 1 ? 's' : ''})`}
            </button>
          )}

          <div className="text-center text-xs text-gray-400 dark:text-gray-600">
            <p>📱 Works best on mobile with your rear camera</p>
            <p className="mt-1">Camera access stays in your browser — nothing is sent until you click "Create PDF"</p>
          </div>
        </div>
      </ToolLayout>
    </>
  )
}
