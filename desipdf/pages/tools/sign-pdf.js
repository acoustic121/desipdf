import Head from 'next/head'
import { useState, useRef, useEffect } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'sign-pdf')
export default function SignPdf() {
  const [file, setFile] = useState(null)
  const [tab, setTab] = useState('draw')
  const [typedName, setTypedName] = useState('')
  const [page, setPage] = useState('1')
  const [x, setX] = useState('50')
  const [y, setY] = useState('100')
  const [sigWidth, setSigWidth] = useState('200')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)
  useEffect(() => {
    if (tab !== 'draw') return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.strokeStyle='#1e3a8a'; ctx.lineWidth=2.5; ctx.lineCap='round'
  }, [tab])
  const getPos = (e,canvas) => { const rect=canvas.getBoundingClientRect(); const src=e.touches?.[0]||e; return {x:src.clientX-rect.left,y:src.clientY-rect.top} }
  const startDraw = (e) => { drawing.current=true; lastPos.current=getPos(e,canvasRef.current) }
  const draw = (e) => { if(!drawing.current)return; e.preventDefault(); const canvas=canvasRef.current; const ctx=canvas.getContext('2d'); const pos=getPos(e,canvas); ctx.beginPath(); ctx.moveTo(lastPos.current.x,lastPos.current.y); ctx.lineTo(pos.x,pos.y); ctx.stroke(); lastPos.current=pos }
  const stopDraw = () => { drawing.current=false }
  const clearCanvas = () => { const canvas=canvasRef.current; const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height) }
  const getSigDataUrl = () => {
    if (tab==='draw') return canvasRef.current.toDataURL('image/png')
    const canvas=document.createElement('canvas'); canvas.width=400; canvas.height=100
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,100); ctx.font='italic 48px Georgia,serif'; ctx.fillStyle='#1e3a8a'; ctx.fillText(typedName,10,70)
    return canvas.toDataURL('image/png')
  }
  const handle = async () => {
    if (!file) return
    if (tab==='type' && !typedName.trim()) return
    const sigDataUrl = getSigDataUrl()
    const base64 = sigDataUrl.split(',')[1]
    const fd = new FormData(); fd.append('file', file); fd.append('signature', base64); fd.append('page', page); fd.append('x', x); fd.append('y', y); fd.append('width', sigWidth)
    await convert('/api/convert/sign-pdf', fd, `signed-${file.name}`)
  }
  return (<>
    <Head><title>Sign PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-5">
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {['draw','type'].map(t => (<button key={t} onClick={()=>setTab(t)} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab===t?'bg-blue-600 text-white':'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{t==='draw'?'✍️ Draw':'⌨️ Type'}</button>))}
        </div>
        {tab==='draw' && <div>
          <div className="flex items-center justify-between mb-2"><label className="label">Draw your signature</label><button onClick={clearCanvas} className="text-xs text-red-500">Clear</button></div>
          <canvas ref={canvasRef} width={500} height={120} className="w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-crosshair touch-none"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}/>
        </div>}
        {tab==='type' && <div>
          <label className="label">Type your name</label>
          <input type="text" value={typedName} onChange={e=>setTypedName(e.target.value)} placeholder="Your full name" className="input-field"/>
          {typedName && <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center"><span style={{fontFamily:'Georgia,serif',fontStyle:'italic',fontSize:'2rem',color:'#1e3a8a'}}>{typedName}</span></div>}
        </div>}
        <div>
          <label className="label">Signature placement (points from bottom-left)</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Page',page,setPage],['X',x,setX],['Y',y,setY],['Width (pt)',sigWidth,setSigWidth]].map(([label,val,setter]) => (
              <div key={label}><label className="label text-xs">{label}</label><input type="number" value={val} onChange={e=>setter(e.target.value)} className="input-field text-sm"/></div>
            ))}
          </div>
        </div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Signing…':'✍️ Sign PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
