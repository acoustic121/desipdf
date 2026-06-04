import SeoHead from '../../components/SeoHead'
import { useState, useRef, useEffect } from 'react'
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

// Helper: Converts hex color to { r, g, b } normalized values
function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255
  return { r, g, b }
}

// Helper: Generates predefined stamp images using HTML5 Canvas
function generateStampDataUrl(text, color = '#10b981') {
  if (typeof window === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 100
  const ctx = canvas.getContext('2d')
  
  // Draw rounded border
  ctx.strokeStyle = color
  ctx.lineWidth = 6
  ctx.strokeRect(8, 8, 284, 84)
  
  // Fill background slightly transparent
  ctx.fillStyle = color + '08' // 5% opacity
  ctx.fillRect(8, 8, 284, 84)

  // Draw inner border line
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(14, 14, 272, 72)
  
  // Draw text
  ctx.fillStyle = color
  ctx.font = 'bold 34px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  // Slightly rotate for realistic stamp effect
  ctx.translate(150, 50)
  ctx.rotate(-0.04)
  ctx.fillText(text, 0, 0)
  
  return canvas.toDataURL('image/png')
}

// Child Component: PDF Page Renderer
function PdfPageRenderer({ pdfDoc, pageNum, scale = 1.25, onRendered }) {
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
        const context = canvas.getContext('2d')
        
        const renderContext = {
          canvasContext: context,
          viewport
        }
        renderTask = page.render(renderContext)
        await renderTask.promise
        if (onRendered) onRendered(viewport.width, viewport.height)
      } catch (err) {
        console.error('Render error:', err)
      }
    }
    render()
    return () => {
      if (renderTask) renderTask.cancel()
    }
  }, [pdfDoc, pageNum, scale])

  return <canvas ref={canvasRef} className="shadow-md rounded-lg w-full h-auto block" />
}

// Child Component: Thumbnail Previewer (Left Sidebar)
function ThumbnailRenderer({ pdfDoc, pageNum, onClick }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pdfDoc) return
    let renderTask = null
    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 0.15 })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')
        const renderContext = {
          canvasContext: context,
          viewport
        }
        renderTask = page.render(renderContext)
        await renderTask.promise
      } catch (err) {
        console.error('Thumbnail render error:', err)
      }
    }
    render()
    return () => {
      if (renderTask) renderTask.cancel()
    }
  }, [pdfDoc, pageNum])

  return (
    <div
      onClick={onClick}
      className="cursor-pointer border-2 border-gray-200 dark:border-gray-800 hover:border-blue-500 rounded-lg p-1 bg-white dark:bg-gray-900 transition-all hover:shadow text-center"
    >
      <canvas ref={canvasRef} className="mx-auto shadow-sm rounded" />
      <p className="text-[10px] text-gray-500 mt-1">Page {pageNum}</p>
    </div>
  )
}

// Child Component: Cursive/Freehand Signature Canvas Creator Modal
function SignatureModal({ isOpen, onClose, onSave }) {
  const [tab, setTab] = useState('draw')
  const [typedName, setTypedName] = useState('')
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
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
    }, 100)
  }, [isOpen, tab])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches?.[0] || e
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY
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
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDraw = () => {
    drawing.current = false
  }

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
      canvas.width = 400
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 400, 100)
      ctx.font = 'italic 42px Georgia, serif'
      ctx.fillStyle = '#000000'
      ctx.fillText(typedName, 20, 60)
      dataUrl = canvas.toDataURL('image/png')
    }
    onSave(dataUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 text-center z-10 border border-gray-100 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create Signature</h2>
        
        {/* Tabs */}
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4">
          <button
            onClick={() => setTab('draw')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'draw' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            ✍️ Draw
          </button>
          <button
            onClick={() => setTab('type')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'type' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            ⌨️ Type
          </button>
        </div>

        {tab === 'draw' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Draw with your mouse or finger</span>
              <button onClick={clearCanvas} className="text-xs text-red-500 font-semibold">Clear</button>
            </div>
            <canvas
              ref={canvasRef}
              width={450}
              height={150}
              className="w-full h-[150px] bg-white rounded-xl border border-gray-300 dark:border-gray-700 cursor-crosshair touch-none"
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
            <label className="label text-left">Type your signature</label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Your full name"
              className="input-field mb-4"
            />
            {typedName && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center select-none">
                <span className="font-serif italic text-3xl text-gray-900 dark:text-gray-100">{typedName}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// MAIN PAGE MODULE
export default function SignPdf() {
  const [file, setFile] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfPages, setPdfPages] = useState([])
  const [pageSizes, setPageSizes] = useState({})
  
  // Editing Tools States
  const [activeTool, setActiveTool] = useState(null) // { type: 'signature'|'stamp'|'text'|'image'|'shape', data/text/shapeType, width, height }
  const [elements, setElements] = useState([]) // array of { id, type, pageNum, x, y, width, height, ... }
  const [activeElementId, setActiveElementId] = useState(null)

  // Modals / Dropdowns
  const [isSigModalOpen, setIsSigModalOpen] = useState(false)
  const [showStampsDropdown, setShowStampsDropdown] = useState(false)
  const [showShapesDropdown, setShowShapesDropdown] = useState(false)

  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  // Fullscreen styling toggler
  useEffect(() => {
    if (file) {
      document.body.classList.add('fullscreen-mode')
    } else {
      document.body.classList.remove('fullscreen-mode')
    }
    return () => {
      document.body.classList.remove('fullscreen-mode')
    }
  }, [file])

  // Load PDF JS and structure pages
  useEffect(() => {
    if (!file) {
      setPdfDoc(null)
      setPdfPages([])
      setPageSizes({})
      setElements([])
      setActiveTool(null)
      setActiveElementId(null)
      return
    }

    const loadPdf = async () => {
      try {
        const { loadPdfJs } = await import('../../utils/clientLoader')
        const pdfjs = await loadPdfJs()
        const arrayBuffer = await file.arrayBuffer()
        const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise
        setPdfDoc(doc)

        const pagesInfo = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: 1 })
          pagesInfo.push({
            pageNum: i,
            width: viewport.width,
            height: viewport.height
          })
        }
        setPdfPages(pagesInfo)
      } catch (err) {
        toast.error('Failed to load PDF file')
        console.error(err)
      }
    }
    loadPdf()
  }, [file])

  const handlePageRendered = (pageNum, w, h) => {
    setPageSizes(prev => ({ ...prev, [pageNum]: { w, h } }))
  }

  // Handle clicking on thumbnails to scroll
  const handleThumbnailClick = (pageNum) => {
    const el = document.getElementById(`page-container-${pageNum}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Placing elements
  const handlePageClick = (e, pageNum) => {
    if (!activeTool) return
    if (e.target !== e.currentTarget) return // click is inside a child element

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Convert pixel offsets to relative percentage of the page width and height
    const xPercent = (clickX / rect.width) * 100
    const yPercent = (clickY / rect.height) * 100

    const newElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: activeTool.type,
      pageNum,
      x: xPercent,
      y: yPercent,
      wPercent: activeTool.wPercent,
      hPercent: activeTool.hPercent,
      data: activeTool.data || '',
      text: activeTool.text || '',
      fontSize: activeTool.fontSize || 16,
      color: activeTool.color || '#000000',
      shapeType: activeTool.shapeType || ''
    }

    setElements(prev => [...prev, newElement])
    setActiveElementId(newElement.id)
  }

  // Mouse Dragging handler
  const dragStart = (e, elId) => {
    e.stopPropagation()
    setActiveElementId(elId)
    const element = elements.find(el => el.id === elId)
    if (!element) return

    const startX = e.clientX
    const startY = e.clientY
    const startXPercent = element.x
    const startYPercent = element.y

    const handleMouseMove = (moveEvent) => {
      const pageEl = document.getElementById(`page-container-${element.pageNum}`)
      if (!pageEl) return
      const rect = pageEl.getBoundingClientRect()

      const deltaXPixels = moveEvent.clientX - startX
      const deltaYPixels = moveEvent.clientY - startY
      
      const deltaXPercent = (deltaXPixels / rect.width) * 100
      const deltaYPercent = (deltaYPixels / rect.height) * 100

      setElements(prev => prev.map(el => {
        if (el.id === elId) {
          return {
            ...el,
            x: Math.max(0, Math.min(100 - el.wPercent, startXPercent + deltaXPercent)),
            y: Math.max(0, Math.min(100 - el.hPercent, startYPercent + deltaYPercent))
          }
        }
        return el
      }))
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Touch Dragging (Mobile with passive override)
  const dragStartTouch = (e, elId) => {
    e.stopPropagation()
    setActiveElementId(elId)
    const element = elements.find(el => el.id === elId)
    if (!element) return

    const startX = e.touches[0].clientX
    const startY = e.touches[0].clientY
    const startXPercent = element.x
    const startYPercent = element.y

    const handleTouchMove = (moveEvent) => {
      if (moveEvent.cancelable) {
        moveEvent.preventDefault() // prevent browser scrolling while dragging element
      }
      
      const pageEl = document.getElementById(`page-container-${element.pageNum}`)
      if (!pageEl) return
      const rect = pageEl.getBoundingClientRect()

      const deltaXPixels = moveEvent.touches[0].clientX - startX
      const deltaYPixels = moveEvent.touches[0].clientY - startY
      
      const deltaXPercent = (deltaXPixels / rect.width) * 100
      const deltaYPercent = (deltaYPixels / rect.height) * 100

      setElements(prev => prev.map(el => {
        if (el.id === elId) {
          return {
            ...el,
            x: Math.max(0, Math.min(100 - el.wPercent, startXPercent + deltaXPercent)),
            y: Math.max(0, Math.min(100 - el.hPercent, startYPercent + deltaYPercent))
          }
        }
        return el
      }))
    }

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove, { passive: false })
      window.removeEventListener('touchend', handleTouchEnd)
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
  }

  // Delete Element
  const deleteElement = (id) => {
    setElements(prev => prev.filter(el => el.id !== id))
    if (activeElementId === id) setActiveElementId(null)
  }

  // Update Text Element content
  const updateElementText = (id, newText) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, text: newText } : el))
  }

  // Resize Element (keeps aspect ratios for images/stamps)
  const resizeElement = (id, newWPercent) => {
    setElements(prev => prev.map(el => {
      if (el.id === id) {
        const ratio = el.hPercent / el.wPercent
        const newHPercent = newWPercent * ratio
        return { ...el, wPercent: newWPercent, hPercent: newHPercent }
      }
      return el
    }))
  }

  // Modify individual props (like color or font size)
  const updateElementProps = (id, props) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...props } : el))
  }

  // Set tools helpers
  const handleSignatureSaved = (sigDataUrl) => {
    setActiveTool({
      type: 'signature',
      data: sigDataUrl,
      wPercent: 20,
      hPercent: 8
    })
  }

  const selectStamp = (text, color) => {
    const stampDataUrl = generateStampDataUrl(text, color)
    setActiveTool({
      type: 'stamp',
      data: stampDataUrl,
      wPercent: 22,
      hPercent: 7.4
    })
    setShowStampsDropdown(false)
  }

  const handleCustomStampUpload = (e) => {
    const fileUploaded = e.target.files?.[0]
    if (!fileUploaded) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const ratio = img.height / img.width
        setActiveTool({
          type: 'stamp',
          data: event.target.result,
          wPercent: 20,
          hPercent: 20 * ratio
        })
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(fileUploaded)
    setShowStampsDropdown(false)
  }

  const selectShape = (shapeType) => {
    setActiveTool({
      type: 'shape',
      shapeType,
      color: '#ef4444',
      wPercent: shapeType === 'line' ? 20 : 6,
      hPercent: shapeType === 'line' ? 1.5 : 6
    })
    setShowShapesDropdown(false)
  }

  const handleCustomImageUpload = (e) => {
    const imgFile = e.target.files?.[0]
    if (!imgFile) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const ratio = img.height / img.width
        setActiveTool({
          type: 'image',
          data: event.target.result,
          wPercent: 20,
          hPercent: 20 * ratio
        })
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(imgFile)
  }

  // Compile and Save PDF using pdf-lib client-side
  const handleSavePdf = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument, rgb } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfLibDoc = await PDFDocument.load(arrayBuffer)
      const pagesList = pdfLibDoc.getPages()
      const helveticaFont = await pdfLibDoc.embedFont('Helvetica')

      for (const el of elements) {
        const pageIndex = Math.min(el.pageNum - 1, pagesList.length - 1)
        const page = pagesList[pageIndex]
        const { width: pageW, height: pageH } = page.getSize()

        // Compute proportional values
        const pdfWidth = (el.wPercent / 100) * pageW
        const pdfHeight = (el.hPercent / 100) * pageH
        const pdfX = (el.x / 100) * pageW
        // In PDF coordinates, Y starts from bottom, whereas in browser overlay it starts from top
        const pdfY = pageH - ((el.y / 100) * pageH) - pdfHeight

        if (el.type === 'signature' || el.type === 'stamp' || el.type === 'image') {
          // Embed PNG/JPG image
          const base64Data = el.data.split(',')[1]
          const isJpg = el.data.startsWith('data:image/jpeg')
          const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
          
          const embeddedImage = isJpg 
            ? await pdfLibDoc.embedJpg(imgBytes)
            : await pdfLibDoc.embedPng(imgBytes)

          page.drawImage(embeddedImage, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight
          })
        } else if (el.type === 'text') {
          if (!el.text.trim()) continue
          const colorRgb = hexToRgb(el.color)
          
          // Render multiple lines of text
          const lines = el.text.split('\n')
          let lineY = pdfY + pdfHeight - el.fontSize

          for (const line of lines) {
            page.drawText(line, {
              x: pdfX,
              y: lineY,
              size: el.fontSize,
              font: helveticaFont,
              color: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
            })
            lineY -= el.fontSize * 1.2 // line height spacing
          }
        } else if (el.type === 'shape') {
          const colorRgb = hexToRgb(el.color)

          if (el.shapeType === 'check') {
            page.drawText('✓', {
              x: pdfX,
              y: pdfY + 4,
              size: pdfHeight * 0.9,
              font: helveticaFont,
              color: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
            })
          } else if (el.shapeType === 'cross') {
            page.drawText('✗', {
              x: pdfX,
              y: pdfY + 4,
              size: pdfHeight * 0.9,
              font: helveticaFont,
              color: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
            })
          } else if (el.shapeType === 'circle') {
            page.drawCircle({
              x: pdfX + pdfWidth / 2,
              y: pdfY + pdfHeight / 2,
              size: Math.min(pdfWidth, pdfHeight) / 2,
              borderWidth: 2,
              borderColor: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
            })
          } else if (el.shapeType === 'rectangle') {
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: pdfWidth,
              height: pdfHeight,
              borderWidth: 2,
              borderColor: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
            })
          } else if (el.shapeType === 'line') {
            page.drawLine({
              start: { x: pdfX, y: pdfY + pdfHeight / 2 },
              end: { x: pdfX + pdfWidth, y: pdfY + pdfHeight / 2 },
              thickness: 2,
              color: rgb(colorRgb.r, colorRgb.g, colorRgb.b)
            })
          }
        }
      }

      const outputBytes = await pdfLibDoc.save()
      return outputBytes
    }, `signed-${file.name}`)
  }

  const activeElement = elements.find(el => el.id === activeElementId)

  // RENDER INTERACTION EDITOR IF FILE ACTIVE
  if (file) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100 font-sans select-none z-[100]">
        <SeoHead
          title="Sign PDF Online – Add Signature, Text and Stamps to PDF"
          description="Sign PDF documents online for free. Draw or type signatures, add stamps, place custom texts, or upload logos and place them on PDF pages."
          keywords="sign pdf online, draw signature on pdf, fill and sign pdf, add text to pdf, rubber stamp pdf online"
          canonical="/tools/sign-pdf"
        />
        {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
        <SignatureModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onSave={handleSignatureSaved}
        />

        {/* Top Header Bar */}
        <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-2 sm:px-4 bg-white dark:bg-gray-900 shrink-0 z-30 shadow-sm gap-2">
          {/* Left: Back / Title */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFile(null)}
              className="px-2.5 py-1.5 rounded-xl text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all font-semibold flex items-center gap-1 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              ← <span className="hidden sm:inline">Close</span>
            </button>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <span className="font-bold text-sm tracking-wide truncate max-w-[150px]">{file.name}</span>
            </div>
          </div>

          {/* Center: Tools (Scrollable on small screens to fit tablets & phones) */}
          <div className="flex-1 flex items-center justify-start sm:justify-center gap-1 bg-gray-50 dark:bg-gray-800/80 p-1 rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-x-auto flex-nowrap no-scrollbar mx-1 sm:mx-4">
            {/* Signature */}
            <button
              onClick={() => setIsSigModalOpen(true)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex-shrink-0 ${
                activeTool?.type === 'signature'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              ✍️ Sign
            </button>

            {/* Stamp */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowStampsDropdown(!showStampsDropdown); setShowShapesDropdown(false); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
                  activeTool?.type === 'stamp'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                🎴 Stamp <span className="text-[9px]">▼</span>
              </button>
              {showStampsDropdown && (
                <div className="absolute top-10 left-0 z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2 space-y-1">
                  {[
                    { text: 'APPROVED', color: '#10b981' },
                    { text: 'REJECTED', color: '#ef4444' },
                    { text: 'SIGN HERE', color: '#3b82f6' },
                    { text: 'CONFIDENTIAL', color: '#f97316' },
                    { text: 'COPY', color: '#6b7280' }
                  ].map(st => (
                    <button
                      key={st.text}
                      onClick={() => selectStamp(st.text, st.color)}
                      className="w-full text-left px-2.5 py-1 text-xs font-semibold rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      style={{ color: st.color }}
                    >
                      {st.text}
                    </button>
                  ))}
                  <label className="block w-full text-left px-2.5 py-1 text-xs font-semibold rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 mt-1">
                    🖼️ Custom...
                    <input type="file" accept="image/*" onChange={handleCustomStampUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* Text */}
            <button
              onClick={() =>
                setActiveTool({
                  type: 'text',
                  text: '',
                  fontSize: 16,
                  color: '#000000',
                  wPercent: 25,
                  hPercent: 6
                })
              }
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex-shrink-0 ${
                activeTool?.type === 'text'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              💬 Text
            </button>

            {/* Image */}
            <label
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer flex-shrink-0 ${
                activeTool?.type === 'image'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              🖼️ Image
              <input type="file" accept="image/*" onChange={handleCustomImageUpload} className="hidden" />
            </label>

            {/* Shapes */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowShapesDropdown(!showShapesDropdown); setShowStampsDropdown(false); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${
                  activeTool?.type === 'shape'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                ✏️ Shape <span className="text-[9px]">▼</span>
              </button>
              {showShapesDropdown && (
                <div className="absolute top-10 left-0 z-50 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2 space-y-1">
                  {[
                    { type: 'check', label: '✓ Check' },
                    { type: 'cross', label: '✗ Cross' },
                    { type: 'circle', label: '○ Circle' },
                    { type: 'rectangle', label: '□ Box' },
                    { type: 'line', label: '— Line' }
                  ].map(sh => (
                    <button
                      key={sh.type}
                      onClick={() => selectShape(sh.type)}
                      className="w-full text-left px-2.5 py-1 text-xs font-semibold rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Save PDF */}
          <button
            onClick={handleSavePdf}
            disabled={loading || elements.length === 0}
            className="px-3 sm:px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-bold rounded-xl transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? '⏳ Saving…' : 'Save PDF'}
          </button>
        </div>

        {/* Floating properties toolbar (if element selected) */}
        {activeElement && (
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex items-center justify-between gap-4 text-xs shrink-0 select-none overflow-x-auto no-scrollbar flex-nowrap">
            <span className="font-bold text-blue-600 shrink-0">Selected: {activeElement.type.toUpperCase()}</span>
            
            {/* Width scale */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span>Size:</span>
              <input
                type="range"
                min="5"
                max="80"
                value={activeElement.wPercent || 20}
                onChange={(e) => resizeElement(activeElement.id, parseInt(e.target.value))}
                className="w-28 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Text options */}
            {activeElement.type === 'text' && (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <span>Color:</span>
                  {['#000000', '#0000ff', '#ef4444', '#10b981'].map(color => (
                    <button
                      key={color}
                      onClick={() => updateElementProps(activeElement.id, { color })}
                      className={`w-3.5 h-3.5 rounded-full border ${activeElement.color === color ? 'ring-1 ring-offset-1 ring-blue-500' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span>Font:</span>
                  <select
                    value={activeElement.fontSize}
                    onChange={(e) => updateElementProps(activeElement.id, { fontSize: parseInt(e.target.value) })}
                    className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded p-0.5 text-[10px]"
                  >
                    {[12, 14, 16, 20, 24, 32].map(sz => (
                      <option key={sz} value={sz}>{sz}px</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Shape color options */}
            {activeElement.type === 'shape' && (
              <div className="flex items-center gap-1 shrink-0">
                <span>Color:</span>
                {['#ef4444', '#10b981', '#3b82f6', '#000000'].map(color => (
                  <button
                    key={color}
                    onClick={() => updateElementProps(activeElement.id, { color })}
                    className={`w-3.5 h-3.5 rounded-full border ${activeElement.color === color ? 'ring-1 ring-offset-1 ring-blue-500' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}

            <button
              onClick={() => deleteElement(activeElement.id)}
              className="ml-auto text-red-500 hover:text-red-600 font-semibold shrink-0"
            >
              🗑️ <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        )}

        {/* Main Work Area */}
        <div className="flex flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">
          {/* Thumbnails Sidebar */}
          <div className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 space-y-4 overflow-y-auto hidden md:block shrink-0">
            <p className="text-[10px] font-bold text-gray-400 tracking-wider mb-2 uppercase">Page Thumbnails</p>
            {pdfPages.map(page => (
              <ThumbnailRenderer
                key={page.pageNum}
                pdfDoc={pdfDoc}
                pageNum={page.pageNum}
                onClick={() => handleThumbnailClick(page.pageNum)}
              />
            ))}
          </div>

          {/* Central PDF Viewer Grid */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8 relative">
            {activeTool && (
              <div className="fixed top-20 z-40 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/40 text-yellow-800 dark:text-yellow-400 text-xs px-4 py-2 rounded-xl shadow flex items-center gap-3">
                <span>⚡ <strong>Placement Mode:</strong> Click on a page to place your {activeTool.type}</span>
                <button onClick={() => setActiveTool(null)} className="text-red-500 font-bold hover:underline">Cancel</button>
              </div>
            )}

            {pdfPages.map(page => (
              <div key={page.pageNum} className="flex flex-col items-center w-full">
                <span className="text-[10px] text-gray-400 mb-2 font-medium">Page {page.pageNum} of {pdfPages.length}</span>
                <div
                  id={`page-container-${page.pageNum}`}
                  onClick={(e) => handlePageClick(e, page.pageNum)}
                  className="relative bg-white border border-gray-200 dark:border-gray-800 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  style={{
                    width: pageSizes[page.pageNum]?.w || page.width * 1.35,
                    maxWidth: '100%',
                    containerType: 'inline-size'
                  }}
                >
                  <PdfPageRenderer
                    pdfDoc={pdfDoc}
                    pageNum={page.pageNum}
                    scale={1.35}
                    onRendered={(w, h) => handlePageRendered(page.pageNum, w, h)}
                  />

                  {/* Absolute Placed Elements Container */}
                  <div className="absolute inset-0 z-10 pointer-events-auto">
                    {elements
                      .filter(el => el.pageNum === page.pageNum)
                      .map(el => {
                        const isSelected = el.id === activeElementId
                        return (
                          <div
                            key={el.id}
                            onMouseDown={(e) => dragStart(e, el.id)}
                            onTouchStart={(e) => dragStartTouch(e, el.id)}
                            className={`absolute ${
                              isSelected
                                ? 'border-2 border-blue-500 ring-2 ring-blue-500/20'
                                : 'border border-dashed border-gray-400 hover:border-blue-400'
                            } p-1`}
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.wPercent}%`,
                              height: `${el.hPercent}%`,
                              touchAction: 'none',
                              containerType: 'size'
                            }}
                          >
                            {isSelected && (
                              <button
                                onMouseDown={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                onTouchStart={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                className="absolute -top-7 right-0 bg-red-500 text-white rounded p-1 shadow hover:bg-red-600 transition-colors z-20"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}

                            {el.type === 'text' && (
                              <textarea
                                value={el.text}
                                onChange={(e) => updateElementText(el.id, e.target.value)}
                                onFocus={() => setActiveElementId(el.id)}
                                className="w-full h-full bg-transparent border-0 outline-none resize-none overflow-hidden font-sans select-text leading-tight p-0"
                                style={{ fontSize: `${el.fontSize / 8}cqw`, color: el.color }}
                                placeholder="Type here..."
                              />
                            )}

                            {(el.type === 'signature' || el.type === 'stamp' || el.type === 'image') && (
                              <img
                                src={el.data}
                                alt={el.type}
                                className="w-full h-full object-contain pointer-events-none"
                              />
                            )}

                            {el.type === 'shape' && (
                              <div
                                className="w-full h-full flex items-center justify-center font-sans font-bold select-none pointer-events-none"
                                style={{ color: el.color, fontSize: '80cqh' }}
                              >
                                {el.shapeType === 'check' && '✓'}
                                {el.shapeType === 'cross' && '✗'}
                                {el.shapeType === 'circle' && (
                                  <div className="w-[85%] h-[85%] rounded-full border-[3px]" style={{ borderColor: el.color }} />
                                )}
                                {el.shapeType === 'rectangle' && (
                                  <div className="w-[85%] h-[85%] border-[3px]" style={{ borderColor: el.color }} />
                                )}
                                {el.shapeType === 'line' && (
                                  <div className="w-[90%] h-0.5" style={{ backgroundColor: el.color }} />
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
          </div>
        </div>
      </div>
    )
  }

  // DEFAULT FILE-UPLOAD LANDING LAYOUT
  return (
    <>
      <SeoHead
        title="Sign PDF Online – Add Signature, Text and Stamps to PDF"
        description="Sign PDF documents online for free. Draw or type signatures, add stamps, place custom texts, or upload logos and place them on PDF pages."
        keywords="sign pdf online, draw signature on pdf, fill and sign pdf, add text to pdf, rubber stamp pdf online"
        canonical="/tools/sign-pdf"
      />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" />
      </ToolLayout>
    </>
  )
}
