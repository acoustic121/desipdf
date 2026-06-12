import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

// ── Utility ───────────────────────────────────────────────────────────────────

function buildDownloadHref({ format, platform, videoUrl }) {
  const params = new URLSearchParams()
  params.set('filename', format.filename || 'video.mp4')
  params.set('platform', platform)

  if (format.downloadType === 'direct' && format.directUrl) {
    // Instagram, TikTok, Facebook, Pinterest — proxy the CDN URL
    params.set('directUrl', format.directUrl)
  } else if (platform === 'youtube') {
    // YouTube — use Innertube streaming via our download proxy
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
  const apiHref = buildDownloadHref({ format, platform, videoUrl })

  const handleClick = async (e) => {
    e.preventDefault()
    if (loading === format.quality) return
    setLoading(format.quality)

    try {
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
    }
  }

  const isThisLoading = loading === format.quality

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
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
            <span>Downloading…</span>
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
