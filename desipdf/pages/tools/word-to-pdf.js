import Head from 'next/head'
import { useState } from 'react'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'
const tool = TOOLS.find((t) => t.id === 'word-to-pdf')
export default function WordToPdf() {
  const [file, setFile] = useState(null)
  const { convert, loading, showLimitModal, setShowLimitModal } = useConvert()
  const handle = async () => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    await convert('/api/convert/word-to-pdf', fd, file.name.replace(/\.docx?$/, '.pdf'))
  }
  return (<>
    <Head><title>Word to PDF – DesiPDF</title></Head>
    {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
    <ToolLayout tool={tool}>
      <FileUpload onFilesSelect={setFile} accept=".doc,.docx" label="Drop your Word document here" sublabel="Supports .doc and .docx files" />
      {file && <div className="mt-6"><button onClick={handle} disabled={loading} className="btn-primary w-full justify-center py-3.5">{loading?'⏳ Converting…':'📄 Convert to PDF'}</button></div>}
    </ToolLayout>
  </>)
}
