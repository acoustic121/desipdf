export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase()
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

export function parsePageRange(rangeStr, totalPages) {
  const pages = new Set()
  const parts = rangeStr.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number)
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        if (i >= 1) pages.add(i)
      }
    } else {
      const n = parseInt(trimmed)
      if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n)
    }
  }
  return Array.from(pages).sort((a, b) => a - b)
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
