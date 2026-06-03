import Head from 'next/head'
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
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file || !password) return
    if (password !== confirm) { const {default:toast} = await import('react-hot-toast'); toast.error('Passwords do not match'); return }
    const fd = new FormData(); fd.append('file', file); fd.append('password', password)
    await convert('/api/convert/protect-pdf', fd, `protected-${file.name}`)
  }
  return (<>
    <Head><title>Protect PDF – DesiPDF</title></Head>
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
