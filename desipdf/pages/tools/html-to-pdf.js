import Head from 'next/head'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { downloadBlob } from '../../utils/helpers'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'html-to-pdf')

const SAMPLE_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; color: #172033; }
      .page { padding: 48px; }
      .brand { color: #2563eb; font-size: 28px; font-weight: 700; }
      .muted { color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin-top: 28px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 12px; text-align: left; }
      th { background: #f8fafc; }
      .total { font-size: 22px; font-weight: 700; text-align: right; margin-top: 24px; }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="brand">PDFChampion</div>
      <p class="muted">HTML to PDF sample document</p>
      <h1>Invoice #1048</h1>
      <p>Convert styled HTML, invoices, reports, receipts, and simple web pages into a PDF.</p>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Document conversion</td><td>1</td><td>₹49</td></tr>
          <tr><td>Priority processing</td><td>1</td><td>₹0</td></tr>
        </tbody>
      </table>
      <div class="total">Total: ₹49</div>
    </main>
  </body>
</html>`

function sanitizeHtml(input, baseUrl = '') {
  if (typeof window === 'undefined') return input

  const parser = new DOMParser()
  const doc = parser.parseFromString(input || '', 'text/html')

  doc.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attr.name)
      }
    })
  })

  if (baseUrl) {
    const base = doc.createElement('base')
    base.href = baseUrl
    doc.head.prepend(base)
  }

  return `<!doctype html>${doc.documentElement.outerHTML}`
}

function getDefaultFilename(mode, url) {
  if (mode !== 'url') return 'html-document.pdf'
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    return `${host || 'webpage'}.pdf`
  } catch {
    return 'webpage.pdf'
  }
}

export default function HtmlToPdf() {
  const [mode, setMode] = useState('html')
  const [html, setHtml] = useState(SAMPLE_HTML)
  const [url, setUrl] = useState('')
  const [pageSize, setPageSize] = useState('a4')
  const [orientation, setOrientation] = useState('portrait')
  const [margin, setMargin] = useState('12')
  const [scale, setScale] = useState('2')
  const [filename, setFilename] = useState('html-document.pdf')
  const [fetching, setFetching] = useState(false)
  const iframeRef = useRef(null)
  const { loading, setLoading, showLimitModal, setShowLimitModal, beginConversion, finishConversion } = useConvert()

  const previewHtml = useMemo(() => sanitizeHtml(html, mode === 'url' ? url : ''), [html, mode, url])

  useEffect(() => {
    setFilename(getDefaultFilename(mode, url))
  }, [mode, url])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setHtml(text)
    setMode('html')
    setFilename(file.name.replace(/\.(html?|txt)$/i, '.pdf') || 'html-document.pdf')
  }

  const fetchUrl = async () => {
    if (!url.trim()) {
      toast.error('Enter a webpage URL first')
      return
    }

    setFetching(true)
    const toastId = toast.loading('Fetching webpage HTML...')
    try {
      const res = await fetch('/api/convert/html-to-pdf-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to fetch webpage')
      setHtml(data.html)
      setFilename(getDefaultFilename('url', data.finalUrl || url))
      toast.success('Webpage loaded. Review the preview, then convert.', { id: toastId })
    } catch (err) {
      toast.error(err.message || 'Unable to fetch webpage', { id: toastId })
    } finally {
      setFetching(false)
    }
  }

  const waitForPreview = async () => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument?.body) throw new Error('Preview is not ready yet')

    const doc = iframe.contentDocument
    await doc.fonts?.ready?.catch(() => {})
    const images = Array.from(doc.images || [])
    await Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
    }))
    return doc
  }

  const handleConvert = async () => {
    if (!html.trim()) {
      toast.error('Add HTML before converting')
      return
    }
    if (!beginConversion()) return

    setLoading(true)
    const toastId = toast.loading('Rendering HTML to PDF...')
    try {
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const html2canvas = html2canvasModule.default
      const doc = await waitForPreview()
      const source = doc.body

      const canvas = await html2canvas(source, {
        backgroundColor: '#ffffff',
        scale: Number(scale),
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: Math.max(source.scrollWidth, doc.documentElement.scrollWidth, 800),
        windowHeight: Math.max(source.scrollHeight, doc.documentElement.scrollHeight, 1000),
      })

      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: pageSize,
        compress: true,
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginMm = Number(margin)
      const usableWidth = pageWidth - marginMm * 2
      const usableHeight = pageHeight - marginMm * 2
      const imgWidth = usableWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pageCanvasHeight = Math.floor((usableHeight * canvas.width) / imgWidth)

      let sourceY = 0
      let pageIndex = 0
      while (sourceY < canvas.height) {
        const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

        if (pageIndex > 0) pdf.addPage(pageSize, orientation)
        const sliceImgHeight = Math.min(usableHeight, imgHeight - pageIndex * usableHeight)
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', marginMm, marginMm, imgWidth, sliceImgHeight)

        sourceY += sliceHeight
        pageIndex += 1
      }

      const blob = pdf.output('blob')
      downloadBlob(blob, filename.trim() || 'html-document.pdf')
      finishConversion(toastId)
    } catch (err) {
      toast.error(err.message || 'Failed to create PDF', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>HTML to PDF – PDFChampion</title></Head>
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <button onClick={() => setMode('html')} className={`py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'html' ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-sm' : 'text-gray-500'}`}>HTML Code</button>
            <button onClick={() => setMode('url')} className={`py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'url' ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-sm' : 'text-gray-500'}`}>Webpage URL</button>
          </div>

          {mode === 'url' && (
            <div className="space-y-2">
              <label className="label">Webpage URL</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/invoice.html" className="input-field" />
                <button onClick={fetchUrl} disabled={fetching} className="btn-secondary justify-center whitespace-nowrap">
                  {fetching ? 'Loading...' : 'Load URL'}
                </button>
              </div>
              <p className="text-xs text-gray-400">Some sites block automated fetching or cross-origin images. Paste HTML directly if a URL cannot be loaded.</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="label mb-0">HTML Source</label>
              <label className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors">
                Upload .html
                <input type="file" accept=".html,.htm,.txt" onChange={handleFile} className="hidden" />
              </label>
            </div>
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} className="input-field min-h-64 font-mono text-xs leading-5" spellCheck={false} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Page Size</label>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="input-field">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
            <div>
              <label className="label">Orientation</label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="input-field">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label className="label">Margin ({margin} mm)</label>
              <input type="range" min="0" max="30" value={margin} onChange={(e) => setMargin(e.target.value)} className="w-full accent-blue-500" />
            </div>
            <div>
              <label className="label">Render Quality</label>
              <select value={scale} onChange={(e) => setScale(e.target.value)} className="input-field">
                <option value="1">Standard</option>
                <option value="2">High</option>
                <option value="3">Ultra</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Output Filename</label>
            <input value={filename} onChange={(e) => setFilename(e.target.value)} className="input-field" />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400">Preview</div>
            <iframe ref={iframeRef} title="HTML preview" srcDoc={previewHtml} className="w-full h-96 bg-white" />
          </div>

          <button onClick={handleConvert} disabled={loading || fetching} className="btn-primary w-full justify-center py-3.5">
            {loading ? 'Rendering PDF...' : '🌐 Convert HTML to PDF'}
          </button>
        </div>
      </ToolLayout>
    </>
  )
}
