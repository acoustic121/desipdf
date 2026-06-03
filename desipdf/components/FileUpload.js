import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { formatFileSize } from '../utils/helpers'
import { MAX_FILE_SIZE_BYTES } from '../utils/constants'

export default function FileUpload({
  onFilesSelect,
  accept = '.pdf',
  multiple = false,
  maxSize = MAX_FILE_SIZE_BYTES,
  label = 'Drop your file here',
  sublabel = 'or click to browse',
}) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      setError('')
      if (rejectedFiles.length > 0) {
        const err = rejectedFiles[0].errors[0]
        if (err.code === 'file-too-large') {
          setError(`File too large. Max size is ${maxSize / 1024 / 1024}MB.`)
        } else if (err.code === 'file-invalid-type') {
          setError(`Invalid file type. Accepted: ${accept}`)
        } else {
          setError(err.message)
        }
        return
      }
      const updated = multiple ? [...files, ...acceptedFiles] : acceptedFiles
      setFiles(updated)
      onFilesSelect(multiple ? updated : updated[0])
    },
    [files, multiple, onFilesSelect, accept, maxSize]
  )

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onFilesSelect(multiple ? updated : null)
  }

  const acceptMap = accept.split(',').reduce((acc, ext) => {
    const trimmed = ext.trim()
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    const mime = mimeMap[trimmed]
    if (mime) acc[mime] = [trimmed]
    return acc
  }, {})

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptMap,
    multiple,
    maxSize,
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`drop-zone ${isDragActive ? 'drop-zone-active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <CloudArrowUpIcon className={`h-14 w-14 ${isDragActive ? 'text-blue-500' : 'text-gray-400'} transition-colors`} />
          <div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">{label}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{sublabel}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              {accept.toUpperCase().replace(/\./g, '')} • Max {maxSize / 1024 / 1024}MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900"
            >
              <DocumentIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-400 hover:text-red-500 transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
