export function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser only'))
    if (window.XLSX) {
      resolve(window.XLSX)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function loadJsZip() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser only'))
    if (window.JSZip) {
      resolve(window.JSZip)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = () => resolve(window.JSZip)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function loadMammoth() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser only'))
    if (window.mammoth) {
      resolve(window.mammoth)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    script.onload = () => resolve(window.mammoth)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Browser only'))
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js'
    script.onload = () => {
      const pdfjsLib = window['pdfjs-dist/build/pdf']
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js'
      resolve(pdfjsLib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}
