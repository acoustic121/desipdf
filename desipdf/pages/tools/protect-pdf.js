import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'protect-pdf')
export default function ProtectPdf() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file || !password) return
    if (password !== confirm) { const {default:toast} = await import('react-hot-toast'); toast.error('Passwords do not match'); return }
    await runClientSide(async () => {
      const { PDFDocument } = await import('pdf-lib')
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const outBytes = await pdfDoc.save({ useObjectStreams: false })

      // Encrypt the saved PDF bytes with the specified password
      const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite')
      const encryptedBytes = await encryptPDF(outBytes, password)
      return encryptedBytes
    }, `protected-${file.name}`)
  }
  return (<>
    <ToolSeoHead tool={tool} />
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".pdf" />
      {file && <div className="mt-6 space-y-4">
        <div><label className="label">Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter a strong password" className="input-field"/></div>
        <div><label className="label">Confirm Password</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter password" className="input-field"/></div>
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-sm text-blue-700 dark:text-blue-300">🔑 Remember this password — encrypted PDFs cannot be opened without it.</div>
        <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Encrypting…':'🔒 Protect PDF'}</button>
      </div>}
    </ToolLayout>
  </>)
}
