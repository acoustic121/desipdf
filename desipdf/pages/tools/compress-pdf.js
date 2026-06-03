import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'compress-pdf')

export default function CompressPdf() {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('medium')
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handle = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('quality', quality)
    await convert('/api/convert/compress-pdf', formData, `compressed-${file.name}`)
  }

  return (
    <>
      <Head><title>Compress PDF – DesiPDF</title></Head>
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={setFile} accept=".pdf" />
        {file && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Compression Level</label>
              <select value={quality} onChange={e=>setQuality(e.target.value)} className="input-field">
                <option value="low">Low compression (best quality)</option>
                <option value="medium">Medium compression (recommended)</option>
                <option value="high">High compression (smallest size)</option>
              </select>
            </div>
            <button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">
              {loading ? '⏳ Compressing…' : '🗜️ Compress PDF'}
            </button>
          </div>
        )}
      </ToolLayout>
    </>
  )
}
