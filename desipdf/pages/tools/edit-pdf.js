import ToolSeoHead from '../../components/ToolSeoHead'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'edit-pdf')

const COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed']
const SHAPES = [
  { id: 'rectangle', label: 'Rectangle', icon: '▢' },
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'arrow', label: 'Arrow', icon: '➜' },
]

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  }
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function getPointerPercent(event, container) {
  const rect = container.getBoundingClientRect()
  const source = event.touches?.[0] || event
  return {
    x: Math.max(0, Math.min(100, ((source.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((source.clientY - rect.top) / rect.height) * 100)),
  }
}

function PdfPageCanvas({ pdfDoc, pageNumber, zoom, onSize }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pdfDoc) return
    let renderTask = null
    let cancelled = false

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale: zoom })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
        await renderTask.promise
        onSize({ width: viewport.width, height: viewport.height })
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error(err)
      }
    }

    render()
    return () => {
      cancelled = true
      if (renderTask) renderTask.cancel()
    }
  }, [pdfDoc, pageNumber, zoom, onSize])

  return <canvas ref={canvasRef} className="block w-full h-auto bg-white shadow-lg" />
}

function Thumbnail({ pdfDoc, pageNumber, active, onClick }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pdfDoc) return
    let renderTask = null

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 0.2 })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
        await renderTask.promise
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error(err)
      }
    }

    render()
    return () => { if (renderTask) renderTask.cancel() }
  }, [pdfDoc, pageNumber])

  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg p-2 transition-all ${active ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-white hover:bg-gray-50 ring-1 ring-gray-200'}`}
    >
      <canvas ref={canvasRef} className="block w-full h-auto bg-white" />
      <span className="mt-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-bold text-gray-600">
        {pageNumber}
      </span>
    </button>
  )
}

function ToolbarButton({ active, onActivate, children, title }) {
  const activate = (event) => {
    event.preventDefault()
    onActivate()
  }
  const activateFromKeyboard = (event) => {
    if (event.detail === 0) activate(event)
  }

  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onPointerDown={activate}
      onClick={activateFromKeyboard}
      className={`flex min-w-[74px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

function TextElement({ element, selected, onChange, onSelect }) {
  return (
    <textarea
      value={element.text}
      onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
      onTouchStart={(event) => { event.stopPropagation(); onSelect(element.id) }}
      onChange={(event) => onChange(element.id, { text: event.target.value })}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.w}%`,
        minHeight: `${element.h}%`,
        color: element.color,
        fontSize: `${element.fontSize}px`,
        fontFamily: element.fontFamily || 'Arial, sans-serif',
        borderColor: selected ? '#2563eb' : 'transparent',
      }}
      className="absolute resize-none rounded border-2 bg-white/80 p-1 font-sans leading-tight outline-none"
    />
  )
}

function LabelElement({ element, selected, onChange, onSelect }) {
  const isStamp = element.type === 'stamp'
  const isNote = element.type === 'note'
  const isLink = element.type === 'link'

  return (
    <textarea
      value={element.text}
      onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
      onTouchStart={(event) => { event.stopPropagation(); onSelect(element.id) }}
      onChange={(event) => onChange(element.id, { text: event.target.value })}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.w}%`,
        height: `${element.h}%`,
        color: isNote ? '#854d0e' : element.color,
        borderColor: selected ? '#2563eb' : element.color,
        backgroundColor: isNote ? '#fef3c7' : isStamp ? `${element.color}18` : 'transparent',
        textDecoration: isLink ? 'underline' : 'none',
        fontSize: `${element.fontSize || 16}px`,
      }}
      className={`absolute resize-none rounded border-2 p-2 text-center font-bold leading-tight outline-none ${isStamp ? 'uppercase' : ''}`}
    />
  )
}

function ShapeElement({ element, selected, onSelect }) {
  const common = {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.w}%`,
    height: `${element.h}%`,
    borderColor: element.color,
    backgroundColor: element.type === 'highlight' || element.type === 'textHighlight' ? `${element.color}55` : 'transparent',
  }

  if (element.type === 'line') {
    return (
      <button
        type="button"
        onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
        style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, borderTopColor: element.color }}
        className={`absolute border-t-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}
        aria-label="Select line"
      />
    )
  }

  if (element.type === 'circle') {
    return (
      <button
        type="button"
        onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
        style={common}
        className={`absolute rounded-full border-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}
        aria-label="Select circle"
      />
    )
  }

  if (element.type === 'arrow') {
    return (
      <svg
        onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%` }}
        className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
        aria-label="Select arrow"
      >
        <line x1="8" y1="50" x2="86" y2="50" stroke={element.color} strokeWidth="6" strokeLinecap="round" />
        <polyline points="70,30 88,50 70,70" fill="none" stroke={element.color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <button
      type="button"
      onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
      style={common}
      className={`absolute rounded border-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}
      aria-label="Select shape"
    />
  )
}

function ImageElement({ element, selected, onSelect }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
      style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.w}%`, height: `${element.h}%` }}
      className={`absolute overflow-hidden border-2 ${selected ? 'border-blue-500' : 'border-transparent'}`}
      aria-label="Select image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={element.data} alt="" className="h-full w-full object-contain" />
    </button>
  )
}

function DrawingElement({ element, selected, onSelect }) {
  const points = element.points.map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <svg
      onMouseDown={(event) => { event.stopPropagation(); onSelect(element.id) }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <polyline points={points} fill="none" stroke={element.color} strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function EditPdf() {
  const [file, setFile] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState({ width: 1, height: 1 })
  const [zoom, setZoom] = useState(1.25)
  const [mode, setMode] = useState('text')
  const [shapeType, setShapeType] = useState('rectangle')
  const [color, setColor] = useState('#111827')
  const [fontSize, setFontSize] = useState(18)
  const [elements, setElements] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [imageTool, setImageTool] = useState(null)
  const drawingRef = useRef(null)
  const pageRef = useRef(null)
  const imageInputRef = useRef(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  const activateTool = (nextMode) => {
    drawingRef.current = null
    setMode(nextMode)
    setSelectedId(null)
    if (nextMode !== 'image') setImageTool(null)
  }

  useEffect(() => {
    if (!file) return
    let cancelled = false

    const load = async () => {
      try {
        const { loadPdfJs } = await import('../../utils/clientLoader')
        const pdfjs = await loadPdfJs()
        const loaded = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
        if (cancelled) return
        setPdfDoc(loaded)
        setPageCount(loaded.numPages)
        setPageNumber(1)
        setElements([])
        setRedoStack([])
        setSelectedId(null)
      } catch (err) {
        toast.error(err.message || 'Unable to open PDF')
      }
    }

    load()
    return () => { cancelled = true }
  }, [file])

  const updateElement = (id, patch) => {
    setElements((current) => current.map((element) => (
      element.id === id ? { ...element, ...patch } : element
    )))
  }

  const addElement = (element) => {
    setElements((current) => [...current, element])
    setRedoStack([])
    setSelectedId(element.id)
  }

  const selectElement = (id) => {
    if (mode === 'eraser') {
      setElements((current) => {
        const removed = current.find((element) => element.id === id)
        if (removed) setRedoStack((stack) => [...stack, removed])
        return current.filter((element) => element.id !== id)
      })
      setSelectedId(null)
      return
    }
    setSelectedId(id)
  }

  const handlePagePointerDown = (event) => {
    if (!pageRef.current) return

    const point = getPointerPercent(event, pageRef.current)
    const base = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      pageNumber,
      x: point.x,
      y: point.y,
      color,
    }

    if (mode === 'text') {
      addElement({ ...base, type: 'text', text: 'Type here', w: 24, h: 7, fontSize })
    } else if (mode === 'editText') {
      setSelectedId(null)
    } else if (mode === 'sign') {
      addElement({ ...base, type: 'text', text: 'Signature', w: 24, h: 8, fontSize: 34, fontFamily: 'Georgia, serif', color })
    } else if (mode === 'highlight') {
      addElement({ ...base, type: 'highlight', w: 24, h: 4 })
    } else if (mode === 'textHighlight') {
      addElement({ ...base, type: 'textHighlight', w: 24, h: 4 })
    } else if (mode === 'shape') {
      if (shapeType === 'circle') {
        addElement({ ...base, type: 'circle', w: 14, h: 14 })
      } else if (shapeType === 'arrow') {
        addElement({ ...base, type: 'arrow', w: 24, h: 8 })
      } else {
        addElement({ ...base, type: 'rectangle', w: 22, h: 12 })
      }
    } else if (mode === 'line') {
      addElement({ ...base, type: 'line', w: 24, h: 1 })
    } else if (mode === 'stamp') {
      addElement({ ...base, type: 'stamp', text: 'APPROVED', w: 20, h: 7, fontSize: 18 })
    } else if (mode === 'link') {
      addElement({ ...base, type: 'link', text: 'https://example.com', w: 28, h: 5, fontSize: 14, color: '#2563eb' })
    } else if (mode === 'note') {
      addElement({ ...base, type: 'note', text: 'Note', w: 22, h: 10, fontSize: 14, color: '#f59e0b' })
    } else if (mode === 'image' && imageTool) {
      addElement({ ...base, type: 'image', data: imageTool.data, w: imageTool.w, h: imageTool.h })
    } else if (mode === 'draw') {
      drawingRef.current = { ...base, type: 'drawing', points: [point] }
      setElements((current) => [...current, drawingRef.current])
    }
  }

  const handlePagePointerMove = (event) => {
    if (!drawingRef.current || !pageRef.current) return
    event.preventDefault()
    const point = getPointerPercent(event, pageRef.current)
    drawingRef.current = {
      ...drawingRef.current,
      points: [...drawingRef.current.points, point],
    }
    setElements((current) => current.map((element) => (
      element.id === drawingRef.current.id ? drawingRef.current : element
    )))
  }

  const stopDrawing = () => {
    if (drawingRef.current) setSelectedId(drawingRef.current.id)
    drawingRef.current = null
  }

  const visibleElements = elements.filter((element) => element.pageNumber === pageNumber)
  const selected = elements.find((element) => element.id === selectedId)

  const handleImageSelect = (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      const img = new Image()
      img.onload = () => {
        const width = 24
        setImageTool({
          data: readerEvent.target.result,
          w: width,
          h: Math.max(8, width * (img.height / img.width)),
        })
        activateTool('image')
        toast.success('Image ready. Click the PDF page to place it.')
      }
      img.src = readerEvent.target.result
    }
    reader.readAsDataURL(selectedFile)
  }

  const undo = () => {
    setElements((current) => {
      const removed = current.at(-1)
      if (removed) setRedoStack((stack) => [...stack, removed])
      return current.slice(0, -1)
    })
    setSelectedId(null)
  }

  const redo = () => {
    setRedoStack((current) => {
      const restored = current.at(-1)
      if (restored) setElements((items) => [...items, restored])
      return current.slice(0, -1)
    })
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setElements((current) => {
      const removed = current.find((element) => element.id === selectedId)
      if (removed) setRedoStack((stack) => [...stack, removed])
      return current.filter((element) => element.id !== selectedId)
    })
    setSelectedId(null)
  }

  const savePdf = async () => {
    if (!file) return

    await runClientSide(async () => {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const pdf = await PDFDocument.load(await file.arrayBuffer())
      const pages = pdf.getPages()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)
      const signatureFont = await pdf.embedFont(StandardFonts.TimesRomanItalic)

      for (const element of elements) {
        const page = pages[element.pageNumber - 1]
        if (!page) continue

        const { width, height } = page.getSize()
        const x = (element.x / 100) * width
        const y = height - (element.y / 100) * height
        const w = (element.w / 100) * width
        const h = (element.h / 100) * height
        const c = hexToRgb(element.color)
        const pdfColor = rgb(c.r, c.g, c.b)

        if ((element.type === 'text' || element.type === 'link') && element.text.trim()) {
          const lines = element.text.split('\n')
          const activeFont = element.fontFamily?.includes('Georgia') ? signatureFont : font
          lines.forEach((line, index) => {
            page.drawText(line, {
              x,
              y: y - element.fontSize - index * element.fontSize * 1.25,
              size: element.fontSize,
              font: activeFont,
              color: pdfColor,
            })
            if (element.type === 'link') {
              const underlineY = y - element.fontSize - index * element.fontSize * 1.25 - 2
              page.drawLine({ start: { x, y: underlineY }, end: { x: x + Math.min(w, line.length * element.fontSize * 0.45), y: underlineY }, thickness: 1, color: pdfColor })
            }
          })
        } else if (element.type === 'stamp' && element.text.trim()) {
          page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: pdfColor, borderWidth: 2, color: pdfColor, opacity: 0.08 })
          page.drawText(element.text.toUpperCase(), {
            x: x + w * 0.08,
            y: y - h * 0.62,
            size: element.fontSize || 18,
            font: boldFont,
            color: pdfColor,
          })
        } else if (element.type === 'note' && element.text.trim()) {
          page.drawRectangle({ x, y: y - h, width: w, height: h, color: rgb(1, 0.95, 0.55), borderColor: rgb(0.92, 0.67, 0.12), borderWidth: 1 })
          page.drawText(element.text, {
            x: x + 6,
            y: y - Math.min(h - 8, element.fontSize + 6),
            size: element.fontSize || 14,
            font,
            color: rgb(0.5, 0.29, 0.04),
          })
        } else if (element.type === 'highlight' || element.type === 'textHighlight') {
          page.drawRectangle({ x, y: y - h, width: w, height: h, color: pdfColor, opacity: 0.28 })
        } else if (element.type === 'rectangle') {
          page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: pdfColor, borderWidth: 2 })
        } else if (element.type === 'circle') {
          page.drawEllipse({ x: x + w / 2, y: y - h / 2, xScale: w / 2, yScale: h / 2, borderColor: pdfColor, borderWidth: 2 })
        } else if (element.type === 'arrow') {
          const start = { x, y: y - h / 2 }
          const end = { x: x + w, y: y - h / 2 }
          page.drawLine({ start, end, thickness: 2.5, color: pdfColor })
          page.drawLine({ start: end, end: { x: x + w * 0.82, y: y - h * 0.18 }, thickness: 2.5, color: pdfColor })
          page.drawLine({ start: end, end: { x: x + w * 0.82, y: y - h * 0.82 }, thickness: 2.5, color: pdfColor })
        } else if (element.type === 'line') {
          page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 2.5, color: pdfColor })
        } else if (element.type === 'image') {
          const bytes = dataUrlToBytes(element.data)
          const image = element.data.startsWith('data:image/jpeg')
            ? await pdf.embedJpg(bytes)
            : await pdf.embedPng(bytes)
          page.drawImage(image, { x, y: y - h, width: w, height: h })
        } else if (element.type === 'drawing' && element.points.length > 1) {
          for (let index = 1; index < element.points.length; index += 1) {
            const previous = element.points[index - 1]
            const next = element.points[index]
            page.drawLine({
              start: { x: (previous.x / 100) * width, y: height - (previous.y / 100) * height },
              end: { x: (next.x / 100) * width, y: height - (next.y / 100) * height },
              thickness: 2,
              color: pdfColor,
            })
          }
        }
      }

      return pdf.save()
    }, file.name.replace(/\.pdf$/i, '-edited.pdf'))
  }

  const onPageSize = useCallback((size) => setPageSize(size), [])

  if (!file) {
    return (
      <>
        <ToolSeoHead tool={tool} />
        {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
        <ToolLayout tool={tool}>
          <FileUpload onFilesSelect={setFile} accept=".pdf" label="Drop your PDF file here" sublabel="Add text, drawings, highlights, images, and shapes" />
        </ToolLayout>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-100 text-gray-900">
      <ToolSeoHead tool={tool} />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setFile(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Back</button>
          <div>
            <p className="text-base font-bold text-gray-900">PDFChampion</p>
            <p className="max-w-[240px] truncate text-xs text-gray-500">{file.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={!elements.length} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40">Undo</button>
          <button onClick={redo} disabled={!redoStack.length} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40">Redo</button>
          <button onClick={deleteSelected} disabled={!selectedId} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40">Delete</button>
          <button onClick={savePdf} disabled={loading} className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-600 disabled:opacity-60">
            {loading ? 'Saving...' : 'Done'}
          </button>
        </div>
      </header>

      <div className="flex h-[74px] shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4">
        <ToolbarButton title="Add text" active={mode === 'text'} onActivate={() => activateTool('text')}><span className="text-2xl">T</span><span>Add text</span></ToolbarButton>
        <ToolbarButton title="Edit text" active={mode === 'editText'} onActivate={() => activateTool('editText')}><span className="text-2xl">✐</span><span>Edit text</span></ToolbarButton>
        <ToolbarButton title="Sign" active={mode === 'sign'} onActivate={() => activateTool('sign')}><span className="text-2xl">✍</span><span>Sign</span></ToolbarButton>
        <ToolbarButton title="Line" active={mode === 'line'} onActivate={() => activateTool('line')}><span className="text-2xl">╱</span><span>Line</span></ToolbarButton>
        <ToolbarButton title="Draw" active={mode === 'draw'} onActivate={() => activateTool('draw')}><span className="text-2xl">✎</span><span>Draw</span></ToolbarButton>
        <ToolbarButton title="Eraser" active={mode === 'eraser'} onActivate={() => activateTool('eraser')}><span className="text-2xl">⌫</span><span>Eraser</span></ToolbarButton>
        <ToolbarButton title="Highlight" active={mode === 'highlight'} onActivate={() => activateTool('highlight')}><span className="text-2xl">▰</span><span>Highlight</span></ToolbarButton>
        <ToolbarButton title="Text highlight" active={mode === 'textHighlight'} onActivate={() => activateTool('textHighlight')}><span className="text-2xl">▣</span><span>Text highlight</span></ToolbarButton>
        <ToolbarButton title="Shape" active={mode === 'shape'} onActivate={() => activateTool('shape')}><span className="text-2xl">{SHAPES.find((shape) => shape.id === shapeType)?.icon}</span><span>Shape</span></ToolbarButton>
        <ToolbarButton title="Image" active={mode === 'image'} onActivate={() => imageInputRef.current?.click()}><span className="text-2xl">☷</span><span>Image</span></ToolbarButton>
        <ToolbarButton title="Stamp" active={mode === 'stamp'} onActivate={() => activateTool('stamp')}><span className="text-2xl">♟</span><span>Stamp</span></ToolbarButton>
        <ToolbarButton title="Link" active={mode === 'link'} onActivate={() => activateTool('link')}><span className="text-2xl">↔</span><span>Link</span></ToolbarButton>
        <ToolbarButton title="Note" active={mode === 'note'} onActivate={() => activateTool('note')}><span className="text-2xl">⌖</span><span>Note</span></ToolbarButton>
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" onChange={handleImageSelect} className="hidden" />

        <div className="ml-2 h-10 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-500">Shape</span>
          <select
            value={shapeType}
            onChange={(event) => {
              setShapeType(event.target.value)
              activateTool('shape')
            }}
            className="h-9 rounded-lg border border-gray-200 px-2 text-sm"
          >
            {SHAPES.map((shape) => (
              <option key={shape.id} value={shape.id}>{shape.label}</option>
            ))}
          </select>
        </div>
        <div className="h-10 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              onClick={() => {
                setColor(swatch)
                if (selected) updateElement(selected.id, { color: swatch })
              }}
              style={{ backgroundColor: swatch }}
              className={`h-6 w-6 rounded-full border-2 ${color === swatch ? 'border-gray-900' : 'border-white'} shadow`}
              aria-label={`Use color ${swatch}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pl-2">
          <span className="text-sm font-semibold text-gray-500">Size</span>
          <input
            type="number"
            min="8"
            max="72"
            value={fontSize}
            onChange={(event) => {
              const value = Number(event.target.value)
              setFontSize(value)
              if (selected?.type === 'text') updateElement(selected.id, { fontSize: value })
            }}
            className="h-9 w-16 rounded-lg border border-gray-200 px-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pl-2">
          <span className="text-sm font-semibold text-gray-500">Zoom</span>
          <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-9 rounded-lg border border-gray-200 px-2 text-sm">
            <option value={0.8}>80%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>
        </div>
        {selected && Number.isFinite(selected.w) && (
          <>
            <div className="ml-2 h-10 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-500">W</span>
              <input
                type="number"
                min="3"
                max="95"
                value={Math.round(selected.w)}
                onChange={(event) => updateElement(selected.id, { w: Number(event.target.value) })}
                className="h-9 w-16 rounded-lg border border-gray-200 px-2 text-sm"
              />
              {selected.type !== 'line' && Number.isFinite(selected.h) && (
                <>
                  <span className="text-sm font-semibold text-gray-500">H</span>
                  <input
                    type="number"
                    min="2"
                    max="95"
                    value={Math.round(selected.h)}
                    onChange={(event) => updateElement(selected.id, { h: Number(event.target.value) })}
                    className="h-9 w-16 rounded-lg border border-gray-200 px-2 text-sm"
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-[170px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-gray-200 bg-white p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Thumbnails</p>
          <div className="space-y-3">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <Thumbnail key={page} pdfDoc={pdfDoc} pageNumber={page} active={page === pageNumber} onClick={() => setPageNumber(page)} />
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-auto bg-gray-200 p-6">
          <div className="mx-auto w-fit">
            <div
              ref={pageRef}
              onMouseDown={handlePagePointerDown}
              onMouseMove={handlePagePointerMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={handlePagePointerDown}
              onTouchMove={handlePagePointerMove}
              onTouchEnd={stopDrawing}
              className={`relative bg-white ${mode === 'eraser' ? 'cursor-not-allowed' : mode === 'editText' ? 'cursor-text' : 'cursor-crosshair'}`}
              style={{ width: pageSize.width, minHeight: pageSize.height }}
            >
              {pdfDoc && <PdfPageCanvas pdfDoc={pdfDoc} pageNumber={pageNumber} zoom={zoom} onSize={onPageSize} />}
              <div className="absolute inset-0">
                {visibleElements.map((element) => {
                  if (element.type === 'text') {
                    return <TextElement key={element.id} element={element} selected={selectedId === element.id} onChange={updateElement} onSelect={selectElement} />
                  }
                  if (element.type === 'stamp' || element.type === 'note' || element.type === 'link') {
                    return <LabelElement key={element.id} element={element} selected={selectedId === element.id} onChange={updateElement} onSelect={selectElement} />
                  }
                  if (element.type === 'image') {
                    return <ImageElement key={element.id} element={element} selected={selectedId === element.id} onSelect={selectElement} />
                  }
                  if (element.type === 'drawing') {
                    return <DrawingElement key={element.id} element={element} selected={selectedId === element.id} onSelect={selectElement} />
                  }
                  return <ShapeElement key={element.id} element={element} selected={selectedId === element.id} onSelect={selectElement} />
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
