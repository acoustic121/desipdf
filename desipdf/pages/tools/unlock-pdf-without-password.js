import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'unlock-pdf-without-password')

export default function UnlockPdfWithoutPassword() {
  const [file, setFile] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const { convert, runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handleFileSelect = (selected) => {
    setFile(selected)
    setNeedsPassword(false)
    setPassword('')
  }

  const handle = async () => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'pdf') {
      // Process entirely in the browser — file never leaves the user's device
      await runClientSide(async () => {
        const { PDFDocument } = await import('pdf-lib')
        const arrayBuffer = await file.arrayBuffer()
        let pdfDoc

        // Step 1: Try loading without any password first.
        // Works for: unprotected PDFs and owner-restriction-only PDFs.
        try {
          pdfDoc = await PDFDocument.load(arrayBuffer)
        } catch (firstErr) {
          const msg = firstErr.message?.toLowerCase() || ''

          // Step 2: If that fails because of encryption, try with the user-supplied password.
          if (msg.includes('password') || msg.includes('encrypt') || msg.includes('decrypt')) {
            if (!password) {
              // Signal the UI to ask for a password — do not show generic error
              setNeedsPassword(true)
              throw new Error(
                'This PDF has an open-file password. Enter it above and click Unlock again. ' +
                'The downloaded file will have the password removed.'
              )
            }
            // Try with the provided password
            try {
              pdfDoc = await PDFDocument.load(arrayBuffer, { password })
            } catch {
              throw new Error('Incorrect password. Please check and try again.')
            }
          } else {
            throw firstErr
          }
        }

        // Save WITHOUT encryption → strips all owner restrictions, print/copy locks,
        // and the open-file password. The downloaded file opens freely.
        const outBytes = await pdfDoc.save()
        return outBytes
      }, `unlocked-${file.name}`)
    } else {
      // Word / Excel: handled by serverless Node.js (uses adm-zip to strip XML protection nodes)
      const formData = new FormData()
      formData.append('file', file)
      await convert('/api/convert/unlock-pdf-without-password', formData, `unlocked_${file.name}`)
    }
  }

  return (
    <>
      <ToolSeoHead tool={tool} />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload
          onFilesSelect={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          label="Drop your PDF, Word, or Excel file here"
          sublabel="Supports .pdf, .doc, .docx, .xls, .xlsx files"
        />

        {file && (
          <div className="mt-6 space-y-4">
            {/* File info */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </div>

            {/* Privacy note */}
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
              🔒 PDFs are processed <strong>100% locally</strong> in your browser and never uploaded to any server.
            </div>

            {/* Password input — only shown when needed (e.g. bank statement PDFs) */}
            {needsPassword && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  🔑 This PDF requires its current password to open. Enter it once below —
                  the downloaded file will have <strong>no password at all</strong>.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Tip: For Indian bank statements, the password is usually your date of birth (e.g. <code>01011990</code>) or account/customer number.
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handle()}
                  placeholder="Enter current PDF password"
                  className="input-field"
                  autoFocus
                />
              </div>
            )}

            <button
              onClick={handle}
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5"
            >
              {loading
                ? '⏳ Unlocking…'
                : needsPassword
                  ? '🔓 Unlock & Remove Password'
                  : '🔓 Unlock File without Password'}
            </button>
          </div>
        )}
      </ToolLayout>
    </>
  )
}
