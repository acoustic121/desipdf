import ToolSeoHead from '../../components/ToolSeoHead'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ToolLayout from '../../components/ToolLayout'
import FileUpload from '../../components/FileUpload'
import { TOOLS } from '../../utils/constants'

const tool = TOOLS.find((t) => t.id === 'bank-statement-converter')

const HEADERS = ['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Page', 'Confidence']
const DATE_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i
const MONEY_RE = /(?:rs\.?|inr|₹)?\s*[-+]?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|(?:rs\.?|inr|₹)?\s*[-+]?\d+(?:\.\d{1,2})/gi
const SKIP_RE = /\b(date|description|particulars|withdrawal|deposit|debit|credit|balance|opening balance|closing balance|statement|account number|branch|ifsc|page)\b/i
const CREDIT_RE = /\b(cr|credit|deposit|received|refund|salary|interest|cashback|upi\/cr|neft\/cr|imps\/cr)\b/i
const DEBIT_RE = /\b(dr|debit|withdrawal|paid|payment|purchase|atm|pos|upi\/dr|neft\/dr|imps\/dr|charge|fee)\b/i

function cleanMoney(value) {
  const cleaned = value
    .replace(/rs\.?|inr|₹/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
  const number = Number(cleaned)
  return Number.isFinite(number) ? Math.abs(number) : null
}

function formatMoney(value) {
  return Number.isFinite(value) && value !== 0 ? value.toFixed(2) : ''
}

function escapeCsv(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function groupTextItemsIntoLines(items) {
  const grouped = []

  items
    .filter((item) => item.str?.trim())
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
    }))
    .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x)
    .forEach((item) => {
      let line = grouped.find((entry) => Math.abs(entry.y - item.y) <= 2)
      if (!line) {
        line = { y: item.y, items: [] }
        grouped.push(line)
      }
      line.items.push(item)
    })

  return grouped
    .sort((a, b) => b.y - a.y)
    .map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseTransactionLine(line, page) {
  const dateMatch = line.match(DATE_RE)
  if (!dateMatch) return null
  if (SKIP_RE.test(line) && !/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(line)) return null

  const date = dateMatch[0]
  const withoutDate = line.replace(dateMatch[0], ' ')
  const moneyMatches = [...withoutDate.matchAll(MONEY_RE)]
    .map((match) => ({ raw: match[0], value: cleanMoney(match[0]), index: match.index }))
    .filter((match) => match.value !== null && match.value > 0)

  if (!moneyMatches.length) return null

  const numbers = moneyMatches.map((match) => match.value)
  let debit = 0
  let credit = 0
  let balance = 0

  if (numbers.length >= 3) {
    debit = numbers[numbers.length - 3]
    credit = numbers[numbers.length - 2]
    balance = numbers[numbers.length - 1]
  } else if (numbers.length === 2) {
    balance = numbers[1]
    if (CREDIT_RE.test(line) && !DEBIT_RE.test(line)) credit = numbers[0]
    else debit = numbers[0]
  } else if (CREDIT_RE.test(line) && !DEBIT_RE.test(line)) {
    credit = numbers[0]
  } else {
    debit = numbers[0]
  }

  let description = withoutDate
  moneyMatches.forEach((match) => {
    description = description.replace(match.raw, ' ')
  })
  description = description.replace(/\b(cr|dr)\b/gi, ' ').replace(/\s+/g, ' ').trim()

  if (!description || description.length < 3) description = 'Transaction'

  return {
    page,
    date,
    description,
    debit,
    credit,
    balance,
    confidence: numbers.length >= 2 ? 'High' : 'Medium',
    raw: line,
  }
}

export default function BankStatementConverter() {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [rawLineCount, setRawLineCount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [outputType, setOutputType] = useState('xlsx')

  const totals = useMemo(() => ({
    debit: rows.reduce((sum, row) => sum + (row.debit || 0), 0),
    credit: rows.reduce((sum, row) => sum + (row.credit || 0), 0),
  }), [rows])

  const processFile = async () => {
    if (!file) return
    setProcessing(true)
    setRows([])
    setRawLineCount(0)

    try {
      const { loadPdfJs } = await import('../../utils/clientLoader')
      const pdfjs = await loadPdfJs()
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
      const extracted = []
      let lineCount = 0

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const lines = groupTextItemsIntoLines(textContent.items)
        lineCount += lines.length
        lines.forEach((line) => {
          const row = parseTransactionLine(line, pageNumber)
          if (row) extracted.push(row)
        })
      }

      setRawLineCount(lineCount)
      setRows(extracted)
      if (extracted.length) toast.success(`Found ${extracted.length} possible transactions`)
      else toast.error('No transaction rows found. This may be a scanned PDF or an unsupported statement layout.')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Unable to read this bank statement')
    } finally {
      setProcessing(false)
    }
  }

  const downloadCsv = () => {
    const csv = [
      HEADERS.join(','),
      ...rows.map((row) => [
        row.date,
        row.description,
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.balance),
        row.page,
        row.confidence,
      ].map(escapeCsv).join(',')),
    ].join('\n')
    downloadBlob(csv, file.name.replace(/\.pdf$/i, '-bank-statement.csv'), 'text/csv;charset=utf-8')
  }

  const downloadExcel = async () => {
    const { loadXLSX } = await import('../../utils/clientLoader')
    const XLSX = await loadXLSX()
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      ...rows.map((row) => [
        row.date,
        row.description,
        row.debit || '',
        row.credit || '',
        row.balance || '',
        row.page,
        row.confidence,
      ]),
    ])
    ws['!cols'] = [{ wch: 14 }, { wch: 46 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    downloadBlob(buffer, file.name.replace(/\.pdf$/i, '-bank-statement.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  const download = async () => {
    if (!rows.length) return
    if (outputType === 'csv') downloadCsv()
    else await downloadExcel()
  }

  return (
    <>
      <ToolSeoHead tool={tool} />
      <ToolLayout tool={tool}>
        <FileUpload onFilesSelect={(selected) => { setFile(selected); setRows([]); setRawLineCount(0) }} accept=".pdf" />

        {file && (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              Works best with text-based bank statement PDFs. Scanned/image-only statements need OCR, which can be added later.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Output format
                <select value={outputType} onChange={(event) => setOutputType(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </label>
              <div className="flex items-end">
                <button onClick={processFile} disabled={processing} className="btn-primary w-full justify-center py-3">
                  {processing ? 'Extracting transactions...' : 'Convert Bank Statement'}
                </button>
              </div>
            </div>

            {!!rows.length && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900">
                    <p className="text-xs text-gray-500">Rows</p>
                    <p className="text-lg font-bold">{rows.length}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3 text-center text-red-700 dark:bg-red-950/30">
                    <p className="text-xs">Debit</p>
                    <p className="text-lg font-bold">{totals.debit.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-green-50 p-3 text-center text-green-700 dark:bg-green-950/30">
                    <p className="text-xs">Credit</p>
                    <p className="text-lg font-bold">{totals.credit.toFixed(2)}</p>
                  </div>
                </div>

                <div className="max-h-80 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      <tr>{HEADERS.slice(0, 5).map((header) => <th key={header} className="px-3 py-2 font-bold">{header}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 30).map((row, index) => (
                        <tr key={`${row.page}-${index}`} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                          <td className="px-3 py-2 min-w-56">{row.description}</td>
                          <td className="px-3 py-2 text-red-600">{formatMoney(row.debit)}</td>
                          <td className="px-3 py-2 text-green-600">{formatMoney(row.credit)}</td>
                          <td className="px-3 py-2">{formatMoney(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button onClick={download} className="btn-primary w-full justify-center py-3">
                  Download {outputType === 'csv' ? 'CSV' : 'Excel'} File
                </button>
              </div>
            )}

            {!rows.length && rawLineCount > 0 && (
              <p className="text-sm text-gray-500">Read {rawLineCount} text lines, but no transaction rows matched the bank statement pattern.</p>
            )}
          </div>
        )}
      </ToolLayout>
    </>
  )
}
