import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

// ── ffmpeg.wasm browser-side download (for 1080p+ adaptive streams) ────────────
//
// YouTube CDN rate-limits server IPs to ~30 MB per adaptive stream session.
// Solution: server deciphers the signed URL, browser fetches directly from CDN
// (residential IP = no rate limit), ffmpeg.wasm merges video + audio.

const FFMPEG_CORE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
const FFMPEG_WASM_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'

// Fetch a stream from YouTube CDN in chunks (4 MB each — safe for browser IP)
async function fetchStreamInChunks(baseUrl, totalSize, onProgress) {
  const CHUNK = 4 * 1024 * 1024 // 4 MB per request
  const chunks = []
  let downloaded = 0

  while (true) {
    const end = totalSize > 0
      ? Math.min(downloaded + CHUNK - 1, totalSize - 1)
      : downloaded + CHUNK - 1
    const resp = await fetch(`${baseUrl}&range=${downloaded}-${end}`, {
      headers: { 'Accept': '*/*' },
    })
    if (!resp.ok) {
      if (downloaded === 0) throw new Error(`CDN returned ${resp.status}`)
      break
    }
    const buf = await resp.arrayBuffer()
    if (buf.byteLength === 0) break
    chunks.push(new Uint8Array(buf))
    downloaded += buf.byteLength
    onProgress?.(downloaded, totalSize)
    if (downloaded >= totalSize && totalSize > 0) break
    if (buf.byteLength < CHUNK) break
  }

  // Concatenate all chunks into a single Uint8Array
  const total = chunks.reduce((s, c) => s + c.byteLength, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) { out.set(c, pos); pos += c.byteLength }
  return out
}

async function downloadHighQualityBrowser({ format, videoUrl, filename, onStatus, onProgress }) {
  // Phase 1: Get deciphered CDN URLs from server
  onStatus('Getting stream URLs…', 0)
  const params = new URLSearchParams({
    videoUrl,
    downloadType: format.downloadType,
    downloadQuality: format.downloadQuality,
  })
  const urlRes = await fetch(`/api/video/get-urls?${params}`)
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to get stream URLs')
  }
  const { videoStreamUrl, audioStreamUrl, videoSize, audioSize } = await urlRes.json()

  // Phase 2: Load ffmpeg.wasm (cached by browser after first load)
  onStatus('Loading video merger…', 2)
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpeg()

  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(FFMPEG_CORE_URL, 'text/javascript'),
      wasmURL: await toBlobURL(FFMPEG_WASM_URL, 'application/wasm'),
    })
  } catch {
    // Fallback: try loading without BlobURL (some environments block blob:)
    await ffmpeg.load({ coreURL: FFMPEG_CORE_URL, wasmURL: FFMPEG_WASM_URL })
  }

  // Phase 3: Download video directly from YouTube CDN (browser IP — no rate limit)
  const mbStr = videoSize > 0 ? ` (${(videoSize / 1e6).toFixed(0)} MB)` : ''
  onStatus(`Downloading ${format.quality} video${mbStr}…`, 5)
  const videoData = await fetchStreamInChunks(videoStreamUrl, videoSize, (dl, total) => {
    const pct = total > 0 ? Math.round((dl / total) * 75) + 5 : 5
    onStatus(`Downloading video… ${(dl / 1e6).toFixed(0)}/${(total / 1e6).toFixed(0)} MB`, pct)
  })
  await ffmpeg.writeFile('video.mp4', videoData)

  // Phase 4: Download audio
  onStatus('Downloading audio…', 80)
  const audioData = await fetchStreamInChunks(audioStreamUrl, audioSize, (dl, total) => {
    const pct = total > 0 ? Math.round((dl / total) * 8) + 80 : 80
    onStatus(`Downloading audio… ${(dl / 1e6).toFixed(1)} MB`, pct)
  })
  await ffmpeg.writeFile('audio.m4a', audioData)

  // Phase 5: Merge with ffmpeg.wasm
  onStatus('Merging video and audio…', 88)
  await ffmpeg.exec([
    '-i', 'video.mp4',
    '-i', 'audio.m4a',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    'output.mp4',
  ])

  // Phase 6: Save file
  onStatus('Saving…', 98)
  const outputData = await ffmpeg.readFile('output.mp4')
  const blob = new Blob([outputData.buffer], { type: 'video/mp4' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename || `video_${format.quality}.mp4`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)

  // Cleanup ffmpeg memory
  try { await ffmpeg.deleteFile('video.mp4'); await ffmpeg.deleteFile('audio.m4a'); await ffmpeg.deleteFile('output.mp4') } catch {}
  onStatus('Done!', 100)
}

// ── Utility ───────────────────────────────────────────────────────────────────

function buildDownloadHref({ format, platform, videoUrl }) {
  const params = new URLSearchParams()
  params.set('filename', format.filename || 'video.mp4')
  params.set('platform', platform)

  if (format.downloadType === 'direct' && format.directUrl) {
    params.set('directUrl', format.directUrl)
  } else if (platform === 'youtube') {
    params.set('videoUrl', videoUrl)
    params.set('downloadType', format.downloadType || 'video')
    params.set('downloadQuality', format.downloadQuality || 'best')
  }

  return `/api/video/download?${params.toString()}`
}

function QualityBadge({ label, type }) {
  const base = 'inline-flex items-center justify-center text-xs font-bold rounded-full px-2.5 py-0.5 min-w-[60px]'
  if (type === 'video') return <span className={`${base} bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300`}>{label}</span>
  return <span className={`${base} bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300`}>{label}</span>
}

function FormatRow({ format, type, platform, videoUrl, loading, setLoading }) {
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const apiHref = buildDownloadHref({ format, platform, videoUrl })
  const isThisLoading = loading === format.quality

  const handleClick = useCallback(async (e) => {
    e.preventDefault()
    if (isThisLoading) return
    setLoading(format.quality)
    setStatus('')
    setProgress(0)

    try {
      // ── High-quality adaptive video: browser-side ffmpeg.wasm download ───────
      // Server-side download is limited to ~30 MB per CDN session.
      // Browser fetches directly from YouTube CDN, no such limit.
      if (platform === 'youtube' && format.downloadType === 'videoOnly') {
        await downloadHighQualityBrowser({
          format,
          videoUrl,
          filename: format.filename,
          onStatus: (msg, pct) => { setStatus(msg); setProgress(pct) },
        })
        return
      }

      // ── Server-side download for all other formats ────────────────────────────
      setStatus('Downloading…')
      const res = await fetch(apiHref)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = format.filename || (type === 'audio' ? 'audio.mp3' : 'video.mp4')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (err) {
      alert(`Download failed: ${err.message}`)
    } finally {
      setLoading(null)
      setStatus('')
      setProgress(0)
    }
  }, [isThisLoading, format, platform, videoUrl, apiHref, type, setLoading])

  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-3">
        <QualityBadge label={format.quality} type={type} />
        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 font-medium">
          {type === 'video' ? `MP4 – ${format.quality}` : `MP3 – ${format.quality}`}
        </span>
        {format.size && (
          <span className="text-xs text-gray-400 dark:text-gray-500 min-w-[60px] text-right">{format.size}</span>
        )}
        <button
          onClick={handleClick}
          disabled={isThisLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-200 shadow-sm
            ${type === 'video'
              ? 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
            }
            ${isThisLoading ? 'opacity-75 cursor-not-allowed' : ''}
          `}
        >
          {isThisLoading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Working…</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download</span>
            </>
          )}
        </button>
      </div>

      {/* Progress bar — shown during browser-side HQ download */}
      {isThisLoading && status && (
        <div className="mt-2 ml-[76px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{status}</span>
            {progress > 0 && <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{progress}%</span>}
          </div>
          {progress > 0 && (
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Main Component ────────────────────────────────────────────────────────────

export default function VideoToolLayout({ tool, children }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [dlLoading, setDlLoading] = useState(null) // which format is downloading
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFetch = async (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch(`/api/video/info?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch video info')
      setResult({ ...data, originalUrl: trimmed })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePaste = () => {
    navigator.clipboard.readText().then(text => {
      setUrl(text)
      inputRef.current?.focus()
    }).catch(() => {})
  }

  const hoursSteps = [
    `Copy the video link from ${tool.platformLabel || tool.name.replace(' Downloader', '')} — tap Share and "Copy link".`,
    `Paste the URL into the input box above.`,
    `Click the Download button and wait for the format list to appear.`,
    `Choose your preferred quality (HD, MP4, MP3) and click Download next to it.`,
    `The file saves automatically to your device's Downloads folder.`,
  ]

  const faqs = tool.faqs || [
    { q: `Is this ${tool.name} free?`, a: `Yes. This tool is completely free with no signup required and no limits.` },
    { q: 'Are my downloads private?', a: 'Yes. No links or files are stored. Processing is stateless and ephemeral.' },
    { q: 'What quality can I download?', a: 'You can choose from all available qualities — from 360p to 1080p for video, and 48kbps to 256kbps for audio.' },
    { q: 'Does it work on mobile?', a: 'Yes. The tool works on all devices including iPhone, Android, tablet, and desktop.' },
    { q: 'Can I download private videos?', a: 'No. Only publicly accessible content can be downloaded.' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/50 dark:from-gray-900/50 to-transparent py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/tools/video-downloader"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 mb-8 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          All Video Tools
        </Link>

        {/* Tool Header */}
        <div className="mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.color || 'from-teal-400 to-cyan-600'} text-3xl shadow-md mb-4`}>
            {tool.icon}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{tool.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{tool.description}</p>
        </div>

        {/* URL Input Card */}
        <div className="card p-6 md:p-8">
          <form onSubmit={handleFetch} className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Paste {tool.platformLabel || 'Video'} URL
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg select-none">🌐</span>
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder={tool.placeholder || 'https://...'}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-medium outline-none transition-all focus:border-teal-500 focus:ring-4 focus:ring-teal-100 dark:focus:ring-teal-900 placeholder:text-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={handlePaste}
                className="px-3 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-all text-sm font-medium whitespace-nowrap"
                title="Paste from clipboard"
              >
                📋 Paste
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold text-sm transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching download options…
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </>
              )}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">❌ {error}</p>
            </div>
          )}

          {/* Results Panel */}
          {result && (
            <div className="mt-6 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {/* Video preview header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                {result.thumbnail && (
                  <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      className="w-full h-full object-cover"
                      onError={e => e.target.style.display = 'none'}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{result.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 capitalize">{result.platform}</p>
                </div>
              </div>

              <div className="p-4 space-y-5">
                {/* Video formats */}
                {result.videoFormats?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span>📹</span> Video
                    </h3>
                    <div>
                      {result.videoFormats.map((fmt, i) => (
                        <FormatRow
                          key={i}
                          format={fmt}
                          type="video"
                          platform={result.platform}
                          videoUrl={result.originalUrl}
                          loading={dlLoading}
                          setLoading={setDlLoading}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio formats */}
                {result.audioFormats?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span>🎵</span> Music / Audio
                    </h3>
                    <div>
                      {result.audioFormats.map((fmt, i) => (
                        <FormatRow
                          key={i}
                          format={fmt}
                          type="audio"
                          platform={result.platform}
                          videoUrl={result.originalUrl}
                          loading={dlLoading}
                          setLoading={setDlLoading}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 dark:text-gray-600">
          <span>🔒 Privacy-first processing</span>
          <span>🆓 100% free</span>
          <span>⚡ Fast downloads</span>
          <span>📱 Works on mobile</span>
        </div>

        <hr className="my-12 border-gray-200 dark:border-gray-800" />

        {/* SEO content */}
        <div className="space-y-10">
          {/* How to use */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>📖</span> How to use {tool.name}
            </h2>
            <ol className="space-y-3">
              {hoursSteps.map((step, i) => (
                <li key={i} className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="leading-6">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Benefits */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>🌟</span> Benefits of {tool.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'No Registration', desc: 'Download instantly without creating an account or providing personal information.' },
                { title: 'Multiple Formats', desc: 'Choose from various quality levels from 360p to 1080p, plus MP3 audio extraction.' },
                { title: 'Works Everywhere', desc: 'Works seamlessly on iPhone, Android, Windows, Mac, and all modern browsers.' },
              ].map((b, i) => (
                <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800/80 bg-white/50 dark:bg-gray-900/50">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{b.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>❓</span> {tool.name} FAQs
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details key={i} className="group border border-gray-100 dark:border-gray-800/80 rounded-xl bg-white/50 dark:bg-gray-900/50 p-4">
                  <summary className="flex items-center justify-between cursor-pointer font-medium text-sm text-gray-800 dark:text-gray-200 list-none">
                    {faq.q}
                    <span className="text-teal-500 text-lg group-open:rotate-45 transition-transform duration-200 flex-shrink-0 ml-2">+</span>
                  </summary>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
