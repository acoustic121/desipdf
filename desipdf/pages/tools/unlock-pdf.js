import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'unlock-pdf')
export default function UnlockPdf() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      let pdfDoc
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer, {
          password,
          ignoreEncryption: true,
        })
      } catch (e) {
        throw new Error('Could not open PDF. Check the password and try again.')
      }
      const outBytes = await pdfDoc.save()
      return outBytes
    }, `unlocked-${file.name}`)
  }
  return (<>
    <Head><title>Unlock PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div><label className="label">PDF Password (if any)</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter the current password" className="input-field"/><p className="text-xs text-gray-400 mt-1">Leave blank if the PDF has no user password.</p></div>
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">⚠️ Only unlock PDFs you own or have permission to unlock.</div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Unlocking…':'🔓 Unlock PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
