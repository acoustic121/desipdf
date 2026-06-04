import SeoHead from '../../components/SeoHead'
import { useState, useRef, useEffect, useCallback } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
import toast from 'react-hot-toast'

const tool = TOOLS.find((t) => t.id === 'sign-pdf') || {
  id: 'sign-pdf',
  name: 'Sign PDF',
  description: 'Draw or type your signature and embed it into any PDF.',
  icon: '✍️',
  color: 'from-indigo-400 to-blue-600',
  accepts: '.pdf',
  category: 'secure',
  status: 'live',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const c = hex.replace('#', '')
  return {
    r: parseInt(c.substring(0, 2), 16) / 255,
    g: parseInt(c.substring(2, 4), 16) / 255,
    b: parseInt(c.substring(4, 6), 16) / 255,
  }
}

function generateStampDataUrl(text, color = '#10b981') {
  if (typeof window === 'undefined') return ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 110
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 320, 110)

    // outer border (no roundRect — use strokeRect for max browser compat)
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.strokeRect(6, 6, 308, 98)

    // background fill
    ctx.fillStyle = color + '18'
    ctx.fillRect(6, 6, 308, 98)

    // inner border
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.strokeRect(12, 12, 296, 86)

    // text
    ctx.fillStyle = color
    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.save()
    ctx.translate(160, 55)
    ctx.rotate(-0.035)
    ctx.fillText(text, 0, 0)
    ctx.restore()
    return canvas.toDataURL('image/png')
  } catch (err) {
    console.error('generateStampDataUrl failed:', err)
    return ''
  }
}

// ─── PDF Page Renderer ───────────────────────────────────────────────────────

function PdfPageRenderer({ pdfDoc, pageNum, scale = 1.4, onRendered }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pdfDoc) return
    let renderTask = null
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
        await renderTask.promise
        if (onRendered) onRendered(viewport.width, viewport.height)
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error('Render error:', err)
      }
    }
    render()
    return () => { if (renderTask) renderTask.cancel() }
  }, [pdfDoc, pageNum, scale])

  return <canvas ref={canvasRef} className="w-full h-auto block" />
}

// ─── Thumbnail Renderer ──────────────────────────────────────────────────────

function ThumbnailRenderer({ pdfDoc, pageNum, isActive, onClick }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pdfDoc) return
    let renderTask = null
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 0.18 })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
        await renderTask.promise
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error('Thumb error:', err)
      }
    }
    render()
    return () => { if (renderTask) renderTask.cancel() }
  }, [pdfDoc, pageNum])

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
        isActive
          ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/30'
          : 'ring-1 ring-white/10 hover:ring-indigo-400/60 hover:shadow-md'
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-auto block bg-white" />
      <p className="text-[10px] text-center py-1 text-slate-400 font-medium">pg {pageNum}</p>
    </div>
  )
}

// ─── Signature Modal ─────────────────────────────────────────────────────────

function SignatureModal({ isOpen, onClose, onSave }) {
  const [tab, setTab] = useState('draw')
  const [typedName, setTypedName] = useState('')
  const [penColor, setPenColor] = useState('#1e3a5f')
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)

  useEffect(() => {
    if (!isOpen || tab !== 'draw') return
    setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = penColor
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }, 80)
  }, [isOpen, tab, penColor])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches?.[0] || e
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e) => {
    drawing.current = true
    lastPos.current = getPos(e, canvasRef.current)
  }
  const draw = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = penColor
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }
  const stopDraw = () => { drawing.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const handleSave = () => {
    let dataUrl
    if (tab === 'draw') {
      dataUrl = canvasRef.current.toDataURL('image/png')
    } else {
      if (!typedName.trim()) return
      const canvas = document.createElement('canvas')
      canvas.width = 500
      canvas.height = 120
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 500, 120)
      ctx.font = 'italic 56px Georgia, serif'
      ctx.fillStyle = penColor
      ctx.fillText(typedName, 20, 80)
      dataUrl = canvas.toDataURL('image/png')
    }
    onSave(dataUrl)
    onClose()
  }

  if (!isOpen) return null

  const penColors = ['#1e3a5f', '#000000', '#1d4ed8', '#7c3aed', '#dc2626']

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Signature</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold">×</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-4 gap-1">
          {[['draw', '✍️ Draw'], ['type', '⌨️ Type']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === id
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* Pen colour strip */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ink:</span>
          {penColors.map(c => (
            <button
              key={c}
              onClick={() => setPenColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${penColor === c ? 'scale-125 border-indigo-400' : 'border-transparent hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {tab === 'draw' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Draw with mouse or finger</span>
              <button onClick={clearCanvas} className="text-xs text-red-500 hover:text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">Clear</button>
            </div>
            <canvas
              ref={canvasRef}
              width={460}
              height={160}
              className="w-full rounded-xl border-2 border-gray-200 dark:border-slate-700 cursor-crosshair touch-none bg-white"
              style={{ height: '160px' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
        )}

        {tab === 'type' && (
          <div>
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {typedName && (
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
                <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '2rem', color: penColor }}>{typedName}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold text-sm hover:from-indigo-600 hover:to-blue-700 transition-all shadow-md">Apply Signature</button>
        </div>
      </div>
    </div>
  )
}

// ─── Stamp Modal ─────────────────────────────────────────────────────────────

function StampModal({ isOpen, onClose, onSelect, onCustomUpload }) {
  if (!isOpen) return null

  const stamps = [
    { text: 'APPROVED',     color: '#10b981', bg: '#10b98118' },
    { text: 'REJECTED',     color: '#ef4444', bg: '#ef444418' },
    { text: 'SIGN HERE',    color: '#3b82f6', bg: '#3b82f618' },
    { text: 'CONFIDENTIAL', color: '#f97316', bg: '#f9731618' },
    { text: 'COPY',         color: '#6b7280', bg: '#6b728018' },
    { text: 'DRAFT',        color: '#8b5cf6', bg: '#8b5cf618' },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 z-10 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-sans">Select Stamp</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold">×</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {stamps.map(st => (
            <button
              key={st.text}
              onClick={() => { onSelect(st.text, st.color); onClose() }}
              className="group p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
            >
              <div 
                className="w-full py-3 px-2 border-2 text-center font-extrabold text-xs tracking-wider rounded transition-transform group-hover:scale-105"
                style={{
                  borderColor: st.color,
                  color: st.color,
                  backgroundColor: st.bg,
                  transform: 'rotate(-2deg)'
                }}
              >
                {st.text}
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
          <label className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl cursor-pointer transition-all text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
            🖼️ Upload custom image stamp
            <input type="file" accept="image/*" onChange={(e) => { onCustomUpload(e); onClose() }} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  )
}

// ─── Shape Modal ─────────────────────────────────────────────────────────────

function ShapeModal({ isOpen, onClose, onSelect }) {
  if (!isOpen) return null

  const shapes = [
    { type: 'check', label: '✓ Checkmark', icon: '✓', color: '#10b981', bg: '#10b98115' },
    { type: 'cross', label: '✗ Cross', icon: '✗', color: '#ef4444', bg: '#ef444415' },
    { type: 'circle', label: '○ Circle', icon: '○', color: '#6366f1', bg: '#6366f115' },
    { type: 'rectangle', label: '□ Box', icon: '□', color: '#f59e0b', bg: '#f59e0b15' },
    { type: 'line', label: '— Line', icon: '—', color: '#64748b', bg: '#64748b15' },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-sans">Select Shape</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold">×</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shapes.map(sh => (
            <button
              key={sh.type}
              onClick={() => { onSelect(sh.type); onClose() }}
              className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 gap-2"
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                style={{
                  color: sh.color,
                  backgroundColor: sh.bg
                }}
              >
                {sh.type === 'circle' && (
                  <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: sh.color }} />
                )}
                {sh.type === 'rectangle' && (
                  <div className="w-5 h-5 border-2" style={{ borderColor: sh.color }} />
                )}
                {sh.type === 'line' && (
                  <div className="w-6 h-0.5" style={{ backgroundColor: sh.color }} />
                )}
                {sh.type !== 'circle' && sh.type !== 'rectangle' && sh.type !== 'line' && sh.icon}
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-sans">{sh.label.split(' ').slice(1).join(' ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function SignPdf() {
  const [file, setFile] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfPages, setPdfPages] = useState([])
  const [pageSizes, setPageSizes] = useState({})
  const [activePage, setActivePage] = useState(1)

  const [activeTool, setActiveTool] = useState(null)
  const [elements, setElements] = useState([])
  const [activeElementId, setActiveElementId] = useState(null)

  const [isSigModalOpen, setIsSigModalOpen] = useState(false)
  const [isStampModalOpen, setIsStampModalOpen] = useState(false)
  const [isShapeModalOpen, setIsShapeModalOpen] = useState(false)

  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  // Fullscreen mode
  useEffect(() => {
    if (file) {
      document.body.classList.add('fullscreen-mode')
    } else {
      document.body.classList.remove('fullscreen-mode')
    }
    return () => document.body.classList.remove('fullscreen-mode')
  }, [file])

  // Load PDF
  useEffect(() => {
    if (!file) {
      setPdfDoc(null); setPdfPages([]); setPageSizes({})
      setElements([]); setActiveTool(null); setActiveElementId(null)
      return
    }
    const loadPdf = async () => {
      try {
        const { loadPdfJs } = await import('../../utils/clientLoader')
        const pdfjs = await loadPdfJs()
        const arrayBuffer = await file.arrayBuffer()
        const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise
        setPdfDoc(doc)
        const pages = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const vp = page.getViewport({ scale: 1 })
          pages.push({ pageNum: i, width: vp.width, height: vp.height })
        }
        setPdfPages(pages)
        setActivePage(1)
      } catch (err) {
        toast.error('Failed to load PDF')
        console.error(err)
      }
    }
    loadPdf()
  }, [file])

  const handlePageRendered = (pageNum, w, h) => {
    setPageSizes(prev => ({ ...prev, [pageNum]: { w, h } }))
  }

  const handleThumbnailClick = (pageNum) => {
    setActivePage(pageNum)
    const el = document.getElementById(`page-container-${pageNum}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // ── Click to place element ─────────────────────────────────────────────────
  // The overlay div (absolute inset-0) receives placement clicks.
  // Child elements (placed annotations) call e.stopPropagation() so they
  // never bubble here — no need for the e.target check.
  const handleOverlayClick = (e, pageNum) => {
    if (!activeTool) return
    // Do NOT check e.target === e.currentTarget — child element clicks are
    // already blocked by stopPropagation on each element div.

    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100

    const newEl = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: activeTool.type,
      pageNum,
      x: Math.max(0, Math.min(100 - activeTool.wPercent, xPct)),
      y: Math.max(0, Math.min(100 - activeTool.hPercent, yPct)),
      wPercent: activeTool.wPercent,
      hPercent: activeTool.hPercent,
      data: activeTool.data || '',
      text: activeTool.text || '',
      fontSize: activeTool.fontSize || 16,
      color: activeTool.color || '#000000',
      shapeType: activeTool.shapeType || '',
    }
    setElements(prev => [...prev, newEl])
    setActiveElementId(newEl.id)
  }

  // ── Drag (mouse) ───────────────────────────────────────────────────────────
  const dragStart = (e, elId) => {
    e.stopPropagation()
    setActiveElementId(elId)
    const element = elements.find(el => el.id === elId)
    if (!element) return

    const startX = e.clientX, startY = e.clientY
    const origX = element.x, origY = element.y

    const onMove = (mv) => {
      const pageEl = document.getElementById(`page-container-${element.pageNum}`)
      if (!pageEl) return
      const rect = pageEl.getBoundingClientRect()
      const dx = ((mv.clientX - startX) / rect.width) * 100
      const dy = ((mv.clientY - startY) / rect.height) * 100
      setElements(prev => prev.map(el => el.id === elId
        ? { ...el, x: Math.max(0, Math.min(100 - el.wPercent, origX + dx)), y: Math.max(0, Math.min(100 - el.hPercent, origY + dy)) }
        : el
      ))
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Drag (touch) ──────────────────────────────────────────────────────────
  const dragStartTouch = (e, elId) => {
    e.stopPropagation()
    setActiveElementId(elId)
    const element = elements.find(el => el.id === elId)
    if (!element) return

    const startX = e.touches[0].clientX, startY = e.touches[0].clientY
    const origX = element.x, origY = element.y

    const onMove = (mv) => {
      if (mv.cancelable) mv.preventDefault()
      const pageEl = document.getElementById(`page-container-${element.pageNum}`)
      if (!pageEl) return
      const rect = pageEl.getBoundingClientRect()
      const dx = ((mv.touches[0].clientX - startX) / rect.width) * 100
      const dy = ((mv.touches[0].clientY - startY) / rect.height) * 100
      setElements(prev => prev.map(el => el.id === elId
        ? { ...el, x: Math.max(0, Math.min(100 - el.wPercent, origX + dx)), y: Math.max(0, Math.min(100 - el.hPercent, origY + dy)) }
        : el
      ))
    }
    const onEnd = () => { window.removeEventListener('touchmove', onMove, { passive: false }); window.removeEventListener('touchend', onEnd) }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }

  const deleteElement = (id) => { setElements(prev => prev.filter(el => el.id !== id)); if (activeElementId === id) setActiveElementId(null) }
  const updateElementText = (id, text) => setElements(prev => prev.map(el => el.id === id ? { ...el, text } : el))
  const resizeElement = (id, wPct) => setElements(prev => prev.map(el => {
    if (el.id !== id) return el
    const ratio = el.hPercent / el.wPercent
    return { ...el, wPercent: wPct, hPercent: wPct * ratio }
  }))
  const updateElementProps = (id, props) => setElements(prev => prev.map(el => el.id === id ? { ...el, ...props } : el))

  // ── Tool setters ─────────────────────────────────────────────────────────
  const handleSignatureSaved = (dataUrl) => setActiveTool({ type: 'signature', data: dataUrl, wPercent: 22, hPercent: 9 })

  const selectStamp = (text, color) => {
    setActiveTool({ type: 'stamp', data: generateStampDataUrl(text, color), wPercent: 24, hPercent: 8 })
  }

  const handleCustomStampUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => setActiveTool({ type: 'stamp', data: ev.target.result, wPercent: 20, hPercent: 20 * (img.height / img.width) })
      img.src = ev.target.result
    }
    reader.readAsDataURL(f)
  }

  const selectShape = (shapeType) => {
    setActiveTool({ type: 'shape', shapeType, color: '#ef4444', wPercent: shapeType === 'line' ? 22 : 7, hPercent: shapeType === 'line' ? 1.5 : 7 })
  }

  const handleCustomImageUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => setActiveTool({ type: 'image', data: ev.target.result, wPercent: 22, hPercent: 22 * (img.height / img.width) })
      img.src = ev.target.result
    }
    reader.readAsDataURL(f)
  }

  // ── Save PDF ─────────────────────────────────────────────────────────────
  const handleSavePdf = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument, rgb } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfLibDoc = await PDFDocument.load(arrayBuffer)
      const pages = pdfLibDoc.getPages()
      const font = await pdfLibDoc.embedFont('Helvetica')

      for (const el of elements) {
        const page = pages[Math.min(el.pageNum - 1, pages.length - 1)]
        const { width: pw, height: ph } = page.getSize()
        const pW = (el.wPercent / 100) * pw
        const pH = (el.hPercent / 100) * ph
        const pX = (el.x / 100) * pw
        const pY = ph - (el.y / 100) * ph - pH

        if (el.type === 'signature' || el.type === 'stamp' || el.type === 'image') {
          const b64 = el.data.split(',')[1]
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
          const img = el.data.startsWith('data:image/jpeg')
            ? await pdfLibDoc.embedJpg(bytes)
            : await pdfLibDoc.embedPng(bytes)
          page.drawImage(img, { x: pX, y: pY, width: pW, height: pH })
        } else if (el.type === 'text' && el.text.trim()) {
          const c = hexToRgb(el.color)
          const lines = el.text.split('\n')
          let ly = pY + pH - el.fontSize
          for (const line of lines) {
            page.drawText(line, { x: pX, y: ly, size: el.fontSize, font, color: rgb(c.r, c.g, c.b) })
            ly -= el.fontSize * 1.2
          }
        } else if (el.type === 'shape') {
          const c = hexToRgb(el.color)
          const rc = rgb(c.r, c.g, c.b)
          if (el.shapeType === 'check') page.drawText('✓', { x: pX, y: pY + 4, size: pH * 0.9, font, color: rc })
          else if (el.shapeType === 'cross') page.drawText('✗', { x: pX, y: pY + 4, size: pH * 0.9, font, color: rc })
          else if (el.shapeType === 'circle') page.drawCircle({ x: pX + pW / 2, y: pY + pH / 2, size: Math.min(pW, pH) / 2, borderWidth: 2, borderColor: rc })
          else if (el.shapeType === 'rectangle') page.drawRectangle({ x: pX, y: pY, width: pW, height: pH, borderWidth: 2, borderColor: rc })
          else if (el.shapeType === 'line') page.drawLine({ start: { x: pX, y: pY + pH / 2 }, end: { x: pX + pW, y: pY + pH / 2 }, thickness: 2, color: rc })
        }
      }
      return await pdfLibDoc.save()
    }, `signed-${file.name}`)
  }

  const activeElement = elements.find(el => el.id === activeElementId)



  // ═══════════════════════════════════════════════════════════════════════════
  // EDITOR LAYOUT (after PDF uploaded)
  // ═══════════════════════════════════════════════════════════════════════════
  if (file) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden z-[100]"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
        <SeoHead
          title="Sign PDF Online – Add Signature, Text and Stamps to PDF"
          description="Sign PDF documents online for free. Draw or type signatures, add stamps, text, shapes and images directly on PDF pages."
          keywords="sign pdf online, draw signature on pdf, fill and sign pdf, add text to pdf, rubber stamp pdf"
          canonical="/tools/sign-pdf"
        />
        {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
        <SignatureModal isOpen={isSigModalOpen} onClose={() => setIsSigModalOpen(false)} onSave={handleSignatureSaved} />
        <StampModal isOpen={isStampModalOpen} onClose={() => setIsStampModalOpen(false)} onSelect={selectStamp} onCustomUpload={handleCustomStampUpload} />
        <ShapeModal isOpen={isShapeModalOpen} onClose={() => setIsShapeModalOpen(false)} onSelect={selectShape} />

        {/* ── TOP NAV BAR ─────────────────────────────────────────────────── */}
        <div className="h-14 flex items-center justify-between px-3 sm:px-5 shrink-0 gap-2"
          style={{ background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(99,102,241,0.25)', backdropFilter: 'blur(12px)' }}>

          {/* Left */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFile(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all text-xs sm:text-sm font-semibold border border-white/10"
            >
              ← <span className="hidden sm:inline">Close</span>
            </button>
            <div className="hidden lg:flex items-center gap-2 pl-2">
              <span className="text-base">✍️</span>
              <span className="text-sm font-semibold text-slate-200 truncate max-w-[160px]">{file.name}</span>
            </div>
          </div>

          {/* Center – Tools */}
          <div className="flex-1 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar mx-2">

            {/* Sign */}
            <button
              onClick={() => setIsSigModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
                activeTool?.type === 'signature'
                  ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              ✍️ Sign
            </button>

            {/* Stamp */}
            <button
              onClick={() => setIsStampModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
                activeTool?.type === 'stamp'
                  ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              🎴 Stamp
            </button>

            {/* Text */}
            <button
              onClick={() => setActiveTool({ type: 'text', text: '', fontSize: 16, color: '#1e3a5f', wPercent: 28, hPercent: 7 })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
                activeTool?.type === 'text'
                  ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              💬 Text
            </button>

            {/* Image */}
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border cursor-pointer ${
              activeTool?.type === 'image'
                ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}>
              🖼️ Image
              <input type="file" accept="image/*" onChange={handleCustomImageUpload} className="hidden" />
            </label>

            {/* Shape */}
            <button
              onClick={() => setIsShapeModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
                activeTool?.type === 'shape'
                  ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              ✏️ Shape
            </button>
          </div>

          {/* Right – Save */}
          <button
            onClick={handleSavePdf}
            disabled={loading || elements.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            style={{
              background: elements.length === 0 ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: elements.length > 0 ? '0 4px 20px rgba(99,102,241,0.5)' : 'none'
            }}
          >
            {loading ? '⏳ Saving…' : '💾 Save PDF'}
          </button>
        </div>

        {/* ── PLACEMENT MODE BANNER ────────────────────────────────────────── */}
        {activeTool && (
          <div className="shrink-0 flex items-center justify-center gap-3 py-2 text-xs font-semibold"
            style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', borderBottom: '1px solid rgba(99,102,241,0.3)' }}>
            <span className="text-indigo-300">
              ⚡ <strong className="text-white">Placement Mode:</strong> Click anywhere on the PDF to place your <span className="text-indigo-300 capitalize">{activeTool.type}</span>
            </span>
            <button
              onClick={() => setActiveTool(null)}
              className="px-2.5 py-0.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── PROPERTIES BAR ───────────────────────────────────────────────── */}
        {activeElement && (
          <div className="shrink-0 flex items-center gap-4 px-4 py-2 overflow-x-auto no-scrollbar"
            style={{ background: 'rgba(30,27,75,0.9)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
            <span className="text-xs font-bold text-indigo-400 whitespace-nowrap">
              {activeElement.type.toUpperCase()}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">Size</span>
              <input
                type="range" min="5" max="80"
                value={activeElement.wPercent || 20}
                onChange={e => resizeElement(activeElement.id, parseInt(e.target.value))}
                className="w-24 accent-indigo-500 cursor-pointer"
              />
            </div>

            {activeElement.type === 'text' && (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-400">Color</span>
                  {['#1e3a5f', '#000000', '#ef4444', '#10b981', '#f59e0b', '#6366f1'].map(color => (
                    <button key={color} onClick={() => updateElementProps(activeElement.id, { color })}
                      className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${activeElement.color === color ? 'scale-125 border-white' : 'border-transparent'}`}
                      style={{ background: color }} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-400">Size</span>
                  <select
                    value={activeElement.fontSize}
                    onChange={e => updateElementProps(activeElement.id, { fontSize: parseInt(e.target.value) })}
                    className="bg-white/10 border border-white/20 text-white rounded-lg px-2 py-0.5 text-xs focus:outline-none"
                  >
                    {[10, 12, 14, 16, 18, 20, 24, 28, 32].map(sz => <option key={sz} value={sz}>{sz}px</option>)}
                  </select>
                </div>
              </>
            )}

            {activeElement.type === 'shape' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-slate-400">Color</span>
                {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#000000'].map(color => (
                  <button key={color} onClick={() => updateElementProps(activeElement.id, { color })}
                    className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${activeElement.color === color ? 'scale-125 border-white' : 'border-transparent'}`}
                    style={{ background: color }} />
                ))}
              </div>
            )}

            <button
              onClick={() => deleteElement(activeElement.id)}
              className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 hover:text-red-300 text-xs font-semibold transition-all shrink-0"
            >
              🗑️ <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        )}

        {/* ── MAIN WORK AREA ───────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <div className="hidden md:flex flex-col w-48 shrink-0 overflow-y-auto p-3 gap-3"
            style={{ background: 'rgba(15,23,42,0.7)', borderRight: '1px solid rgba(99,102,241,0.15)' }}>
            <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase px-1">Pages</p>
            {pdfPages.map(page => (
              <ThumbnailRenderer
                key={page.pageNum}
                pdfDoc={pdfDoc}
                pageNum={page.pageNum}
                isActive={activePage === page.pageNum}
                onClick={() => handleThumbnailClick(page.pageNum)}
              />
            ))}
          </div>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-10"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}>
            {pdfPages.map(page => (
              <div key={page.pageNum} className="flex flex-col items-center w-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-3 py-0.5 rounded-full">
                    Page {page.pageNum} / {pdfPages.length}
                  </span>
                </div>

                {/* Page container – no onClick here, it's on the overlay */}
                <div
                  id={`page-container-${page.pageNum}`}
                  className="relative shadow-2xl"
                  style={{
                    width: pageSizes[page.pageNum]?.w || page.width * 1.4,
                    maxWidth: '100%',
                    containerType: 'inline-size',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.2)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <PdfPageRenderer
                    pdfDoc={pdfDoc}
                    pageNum={page.pageNum}
                    scale={1.4}
                    onRendered={(w, h) => handlePageRendered(page.pageNum, w, h)}
                  />

                  {/* Overlay – THIS div receives placement clicks */}
                  <div
                    className="absolute inset-0 z-10"
                    style={{ cursor: activeTool ? 'crosshair' : 'default' }}
                    onClick={(e) => handleOverlayClick(e, page.pageNum)}
                  >
                    {elements
                      .filter(el => el.pageNum === page.pageNum)
                      .map(el => {
                        const isSelected = el.id === activeElementId
                        return (
                          <div
                            key={el.id}
                            onMouseDown={e => dragStart(e, el.id)}
                            onTouchStart={e => dragStartTouch(e, el.id)}
                            className="absolute"
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.wPercent}%`,
                              height: `${el.hPercent}%`,
                              touchAction: 'none',
                              containerType: 'size',
                              cursor: 'move',
                              outline: isSelected ? '2px solid #6366f1' : '1.5px dashed rgba(99,102,241,0.5)',
                              outlineOffset: '2px',
                              boxShadow: isSelected ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none',
                              borderRadius: '3px',
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            {/* Delete button */}
                            {isSelected && (
                              <button
                                onMouseDown={e => { e.stopPropagation(); deleteElement(el.id) }}
                                onTouchStart={e => { e.stopPropagation(); deleteElement(el.id) }}
                                className="absolute -top-6 right-0 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-20 transition-colors"
                                style={{ fontSize: '10px', lineHeight: 1 }}
                              >×</button>
                            )}

                            {el.type === 'text' && (
                              <textarea
                                value={el.text}
                                onChange={e => updateElementText(el.id, e.target.value)}
                                onFocus={() => setActiveElementId(el.id)}
                                onClick={e => e.stopPropagation()}
                                className="w-full h-full bg-transparent border-0 outline-none resize-none overflow-hidden leading-tight p-0.5 font-medium"
                                style={{ fontSize: `${el.fontSize / 8}cqw`, color: el.color, cursor: 'text' }}
                                placeholder="Type here…"
                              />
                            )}

                            {(el.type === 'signature' || el.type === 'stamp' || el.type === 'image') && (
                              <img src={el.data} alt={el.type} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
                            )}

                            {el.type === 'shape' && (
                              <div className="w-full h-full flex items-center justify-center pointer-events-none select-none"
                                style={{ color: el.color, fontSize: '80cqh' }}>
                                {el.shapeType === 'check' && '✓'}
                                {el.shapeType === 'cross' && '✗'}
                                {el.shapeType === 'circle' && (
                                  <div className="w-[85%] h-[85%] rounded-full" style={{ border: `3px solid ${el.color}` }} />
                                )}
                                {el.shapeType === 'rectangle' && (
                                  <div className="w-[85%] h-[85%]" style={{ border: `3px solid ${el.color}` }} />
                                )}
                                {el.shapeType === 'line' && (
                                  <div className="w-[90%]" style={{ height: '3px', background: el.color }} />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            ))}

            {/* Bottom padding */}
            <div className="h-16" />
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE UPLOAD LANDING
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <SeoHead
        title="Sign PDF Online – Add Signature, Text and Stamps to PDF"
        description="Sign PDF documents online for free. Draw or type signatures, add stamps, text, shapes and images directly on PDF pages."
        keywords="sign pdf online, draw signature on pdf, fill and sign pdf, add text to pdf, rubber stamp pdf"
        canonical="/tools/sign-pdf"
      />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" />
      </ToolLayout>
    </>
  )
}
