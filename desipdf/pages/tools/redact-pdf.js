import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'redact-pdf')
export default function RedactPdf() {
  const [file, setFile] = useState(null)
  const [regions, setRegions] = useState([{page:'1',x:'50',y:'700',width:'200',height:'20'}])
  const add = () => setRegions([...regions,{page:'1',x:'50',y:'700',width:'200',height:'20'}])
  const upd = (i,f,v) => { const r=[...regions]; r[i][f]=v; setRegions(r) }
  const rem = (i) => setRegions(regions.filter((_,idx)=>idx!==i))
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument, rgb } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pages = pdfDoc.getPages()

      for (const r of regions) {
        const pageIndex = parseInt(r.page || '1') - 1
        if (pageIndex < 0 || pageIndex >= pages.length) continue
        const page = pages[pageIndex]
        page.drawRectangle({
          x: parseFloat(r.x || '0'),
          y: parseFloat(r.y || '0'),
          width: parseFloat(r.width || '0'),
          height: parseFloat(r.height || '0'),
          color: rgb(0, 0, 0),
          opacity: 1,
        })
      }

      const outBytes = await pdfDoc.save()
      return outBytes
    }, `redacted-${file.name}`)
  }
  return (<>
    <Head><title>Redact PDF – PDFChampion</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Specify page and coordinates (points from bottom-left) to permanently black out.</p>
        {regions.map((r,i) => (
          <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Region {i+1}</span>{regions.length>1&&<button onClick={()=>rem(i)} className="text-xs text-red-500">Remove</button>}</div>
            <div className="grid grid-cols-3 gap-2">
              {[['page','Page'],['x','X (pt)'],['y','Y (pt)'],['width','Width (pt)'],['height','Height (pt)']].map(([field,label]) => (
                <div key={field}><label className="label text-xs">{label}</label><input type="number" value={r[field]} onChange={e=>upd(i,field,e.target.value)} className="input-field text-sm"/></div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={add} className="btn-secondary w-full justify-center py-2.5 text-sm">+ Add Region</button>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Redacting…':'🖤 Redact PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
