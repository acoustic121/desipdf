import ToolSeoHead from '../../components/ToolSeoHead'
import { useState } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import LimitModal from '../../components/LimitModal'
import { TOOLS } from '../../utils/constants'
import { useConvert } from '../../utils/useConvert'

const tool = TOOLS.find((t) => t.id === 'compare-pdf')

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width)
  canvas.height = Math.ceil(height)
  return canvas
}

function fillWhite(canvas) {
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return ctx
}

async function renderPdf(file, scale) {
  const { loadPdfJs } = await import('../../utils/clientLoader')
  const pdfjs = await loadPdfJs()
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = fillWhite(canvas)
    await page.render({ canvasContext: context, viewport }).promise
    pages.push({ pageNumber: index, canvas })
  }

  return pages
}

function normalizeCanvas(source, width, height) {
  const canvas = createCanvas(width, height)
  const ctx = fillWhite(canvas)
  if (!source) return canvas

  const scale = Math.min(width / source.width, height / source.height)
  const drawWidth = source.width * scale
  const drawHeight = source.height * scale
  ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  return canvas
}

function compareCanvases(originalCanvas, revisedCanvas, threshold) {
  const width = Math.max(originalCanvas?.width || 0, revisedCanvas?.width || 0, 1)
  const height = Math.max(originalCanvas?.height || 0, revisedCanvas?.height || 0, 1)
  const original = normalizeCanvas(originalCanvas, width, height)
  const revised = normalizeCanvas(revisedCanvas, width, height)
  const diff = createCanvas(width, height)

  const originalCtx = original.getContext('2d')
  const revisedCtx = revised.getContext('2d')
  const diffCtx = diff.getContext('2d')
  const originalData = originalCtx.getImageData(0, 0, width, height)
  const revisedData = revisedCtx.getImageData(0, 0, width, height)
  const diffData = diffCtx.createImageData(width, height)

  let changedPixels = 0
  const dataLength = originalData.data.length

  for (let i = 0; i < dataLength; i += 4) {
    const r1 = originalData.data[i]
    const g1 = originalData.data[i + 1]
    const b1 = originalData.data[i + 2]
    const r2 = revisedData.data[i]
    const g2 = revisedData.data[i + 1]
    const b2 = revisedData.data[i + 2]
    const delta = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
    const isDifferent = delta > threshold

    if (isDifferent) {
      changedPixels += 1
      diffData.data[i] = 239
      diffData.data[i + 1] = 68
      diffData.data[i + 2] = 68
      diffData.data[i + 3] = 255
    } else {
      const gray = Math.round((r1 + g1 + b1) / 3)
      diffData.data[i] = Math.min(255, gray + 45)
      diffData.data[i + 1] = Math.min(255, gray + 45)
      diffData.data[i + 2] = Math.min(255, gray + 45)
      diffData.data[i + 3] = 255
    }
  }

  diffCtx.putImageData(diffData, 0, 0)

  const totalPixels = width * height
  const differencePercent = totalPixels ? (changedPixels / totalPixels) * 100 : 0

  return {
    changedPixels,
    totalPixels,
    differencePercent,
    originalPreview: original.toDataURL('image/jpeg', 0.78),
    revisedPreview: revised.toDataURL('image/jpeg', 0.78),
    diffPreview: diff.toDataURL('image/jpeg', 0.86),
  }
}

async function createReport(results, summary, originalName, revisedName) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text('PDFChampion Compare PDF Report', 14, 18)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(`Original: ${originalName}`, 14, 28)
  pdf.text(`Revised: ${revisedName}`, 14, 34)
  pdf.text(`Pages checked: ${summary.pagesCompared}`, 14, 40)
  pdf.text(`Pages with differences: ${summary.pagesWithDifferences}`, 14, 46)
  pdf.text(`Average difference: ${summary.averageDifference.toFixed(2)}%`, 14, 52)

  results.forEach((result, index) => {
    if (index > 0) pdf.addPage('a4', 'landscape')
    const top = index === 0 ? 64 : 18

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text(`Page ${result.pageNumber} - ${result.differencePercent.toFixed(2)}% different`, 14, top - 6)

    const columnGap = 6
    const columnWidth = (pageWidth - 28 - columnGap * 2) / 3
    const imageHeight = Math.min(pageHeight - top - 18, columnWidth * 1.35)
    const labels = ['Original', 'Revised', 'Differences']
    const images = [result.originalPreview, result.revisedPreview, result.diffPreview]

    images.forEach((image, imageIndex) => {
      const x = 14 + imageIndex * (columnWidth + columnGap)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text(labels[imageIndex], x, top)
      pdf.addImage(image, 'JPEG', x, top + 4, columnWidth, imageHeight)
    })
  })

  return pdf.output('blob')
}

function summarizeResults(results) {
  const pagesCompared = results.length
  const pagesWithDifferences = results.filter((result) => result.changedPixels > 0).length
  const averageDifference = pagesCompared
    ? results.reduce((total, result) => total + result.differencePercent, 0) / pagesCompared
    : 0

  return { pagesCompared, pagesWithDifferences, averageDifference }
}

export default function ComparePdf() {
  const [originalFile, setOriginalFile] = useState(null)
  const [revisedFile, setRevisedFile] = useState(null)
  const [quality, setQuality] = useState('1.2')
  const [sensitivity, setSensitivity] = useState('45')
  const [results, setResults] = useState([])
  const [summary, setSummary] = useState(null)
  const { runClientSide, loading, showLimitModal, setShowLimitModal } = useConvert()

  const handleCompare = async () => {
    if (!originalFile || !revisedFile) {
      toast.error('Upload both PDF files first')
      return
    }

    await runClientSide(async () => {
      const [originalPages, revisedPages] = await Promise.all([
        renderPdf(originalFile, Number(quality)),
        renderPdf(revisedFile, Number(quality)),
      ])

      const pageCount = Math.max(originalPages.length, revisedPages.length)
      const comparisonResults = []

      for (let index = 0; index < pageCount; index += 1) {
        const compared = compareCanvases(
          originalPages[index]?.canvas,
          revisedPages[index]?.canvas,
          Number(sensitivity)
        )
        comparisonResults.push({
          pageNumber: index + 1,
          missingOriginal: !originalPages[index],
          missingRevised: !revisedPages[index],
          ...compared,
        })
      }

      const comparisonSummary = summarizeResults(comparisonResults)
      setResults(comparisonResults)
      setSummary(comparisonSummary)

      return createReport(
        comparisonResults,
        comparisonSummary,
        originalFile.name,
        revisedFile.name
      )
    }, 'pdf-comparison-report.pdf')
  }

  return (
    <>
      <ToolSeoHead tool={tool} />
      {showLimitModal && <LimitModal onClose={() => setShowLimitModal(false)} />}
      <ToolLayout tool={tool}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="label">Original PDF</label>
              <FileUpload onFilesSelect={setOriginalFile} accept=".pdf" label="Upload original PDF" sublabel="First version of your document" />
            </div>
            <div>
              <label className="label">Revised PDF</label>
              <FileUpload onFilesSelect={setRevisedFile} accept=".pdf" label="Upload revised PDF" sublabel="New version to compare" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Render Quality</label>
              <select value={quality} onChange={(event) => setQuality(event.target.value)} className="input-field">
                <option value="0.9">Standard - fastest</option>
                <option value="1.2">High - recommended</option>
                <option value="1.6">Ultra - sharper preview</option>
              </select>
            </div>
            <div>
              <label className="label">Sensitivity</label>
              <select value={sensitivity} onChange={(event) => setSensitivity(event.target.value)} className="input-field">
                <option value="70">Low - ignore tiny changes</option>
                <option value="45">Balanced - recommended</option>
                <option value="24">High - catch small changes</option>
              </select>
            </div>
          </div>

          <button onClick={handleCompare} disabled={loading || !originalFile || !revisedFile} className="btn-primary w-full justify-center py-3.5">
            {loading ? 'Comparing PDFs...' : 'Compare PDFs'}
          </button>

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Pages checked</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.pagesCompared}</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Pages changed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.pagesWithDifferences}</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Average difference</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.averageDifference.toFixed(2)}%</p>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Comparison Results</h2>
              {results.map((result) => (
                <div key={result.pageNumber} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Page {result.pageNumber}</h3>
                      {(result.missingOriginal || result.missingRevised) && (
                        <p className="text-xs text-red-500">
                          {result.missingOriginal ? 'Missing in original PDF' : 'Missing in revised PDF'}
                        </p>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${result.changedPixels ? 'text-red-500' : 'text-green-600'}`}>
                      {result.differencePercent.toFixed(2)}% different
                    </span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
                    <PreviewPanel title="Original" image={result.originalPreview} />
                    <PreviewPanel title="Revised" image={result.revisedPreview} />
                    <PreviewPanel title="Differences" image={result.diffPreview} highlight />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ToolLayout>
    </>
  )
}

function PreviewPanel({ title, image, highlight = false }) {
  return (
    <div>
      <p className={`text-xs font-semibold mb-2 ${highlight ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{title}</p>
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={`${title} preview`} className="w-full h-auto block" />
      </div>
    </div>
  )
}
