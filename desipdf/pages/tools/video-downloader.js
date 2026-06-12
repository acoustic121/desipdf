import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import SeoHead from '../../components/SeoHead'

// ── Platform data matching VidsSave ───────────────────────────────────────────

const PLATFORMS = [
  {
    name: 'YouTube',
    icon: '▶️',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-100 dark:border-red-900/40',
    tools: [
      { name: 'YouTube Downloader', href: '/tools/video/youtube-downloader', icon: '🎬' },
      { name: 'YouTube Video Downloader', href: '/tools/video/youtube-video-downloader', icon: '📹' },
      { name: 'YouTube Shorts Downloader', href: '/tools/video/youtube-shorts-downloader', icon: '⚡' },
      { name: 'YouTube to MP3', href: '/tools/video/youtube-to-mp3', icon: '🎵' },
      { name: 'YouTube Audio Downloader', href: '/tools/video/youtube-audio-downloader', icon: '🔊' },
      { name: 'YouTube Song Downloader', href: '/tools/video/youtube-song-downloader', icon: '🎶' },
      { name: 'YouTube to MP4', href: '/tools/video/youtube-to-mp4', icon: '💾' },
      { name: 'YouTube Music Downloader', href: '/tools/video/youtube-music-downloader', icon: '🎼' },
      { name: 'YouTube Movies Downloader', href: '/tools/video/youtube-movies-downloader', icon: '🎥' },
    ],
  },
  {
    name: 'Instagram',
    icon: '📸',
    color: 'from-pink-500 to-fuchsia-600',
    bg: 'bg-pink-50 dark:bg-pink-950/20',
    border: 'border-pink-100 dark:border-pink-900/40',
    tools: [
      { name: 'Instagram Downloader', href: '/tools/video/instagram-downloader', icon: '📸' },
      { name: 'Instagram Video Downloader', href: '/tools/video/instagram-video-downloader', icon: '📹' },
      { name: 'Instagram Photo Downloader', href: '/tools/video/instagram-photo-downloader', icon: '🖼️' },
      { name: 'Instagram Reels Downloader', href: '/tools/video/instagram-reels-downloader', icon: '🎞️' },
      { name: 'Instagram Story Downloader', href: '/tools/video/instagram-story-downloader', icon: '⭕' },
      { name: 'Instagram Carousel Downloader', href: '/tools/video/instagram-carousel-downloader', icon: '🎠' },
      { name: 'Instagram Profile Downloader', href: '/tools/video/instagram-profile-downloader', icon: '👤' },
    ],
  },
  {
    name: 'Facebook',
    icon: '👥',
    color: 'from-blue-600 to-indigo-700',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-100 dark:border-blue-900/40',
    tools: [
      { name: 'Facebook Video Downloader', href: '/tools/video/facebook-downloader', icon: '📹' },
    ],
  },
  {
    name: 'TikTok',
    icon: '🎵',
    color: 'from-slate-800 to-gray-900',
    bg: 'bg-gray-50 dark:bg-gray-900/50',
    border: 'border-gray-100 dark:border-gray-800',
    tools: [
      { name: 'TikTok Downloader', href: '/tools/video/tiktok-downloader', icon: '🎵' },
    ],
  },
  {
    name: 'Pinterest',
    icon: '📌',
    color: 'from-red-600 to-rose-700',
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-100 dark:border-rose-900/40',
    tools: [
      { name: 'Pinterest Downloader', href: '/tools/video/pinterest-downloader', icon: '📌' },
      { name: 'Pinterest GIF Downloader', href: '/tools/video/pinterest-gif-downloader', icon: '🎭' },
    ],
  },
]

const SUPPORTED_PLATFORMS = [
  { name: 'YouTube', icon: '▶️', href: '/tools/video/youtube-downloader', desc: 'Download YouTube videos, shorts & music' },
  { name: 'Facebook', icon: '👥', href: '/tools/video/facebook-downloader', desc: 'Download Facebook videos & reels' },
  { name: 'Instagram', icon: '📸', href: '/tools/video/instagram-downloader', desc: 'Download reels, stories & photos' },
  { name: 'TikTok', icon: '🎵', href: '/tools/video/tiktok-downloader', desc: 'Download TikTok videos without watermark' },
  { name: 'Pinterest', icon: '📌', href: '/tools/video/pinterest-downloader', desc: 'Download Pinterest images, GIFs & videos' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function VideoDownloaderHub() {
  const router = useRouter()
  const [url, setUrl] = useState('')

  const handleDownload = (e) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    // Auto-detect platform and route to the appropriate tool
    if (/youtube\.com|youtu\.be/.test(trimmed)) router.push(`/tools/video/youtube-downloader?url=${encodeURIComponent(trimmed)}`)
    else if (/instagram\.com/.test(trimmed)) router.push(`/tools/video/instagram-downloader?url=${encodeURIComponent(trimmed)}`)
    else if (/tiktok\.com/.test(trimmed)) router.push(`/tools/video/tiktok-downloader?url=${encodeURIComponent(trimmed)}`)
    else if (/facebook\.com|fb\.watch/.test(trimmed)) router.push(`/tools/video/facebook-downloader?url=${encodeURIComponent(trimmed)}`)
    else if (/pinterest\.com|pin\.it/.test(trimmed)) router.push(`/tools/video/pinterest-downloader?url=${encodeURIComponent(trimmed)}`)
    else router.push(`/tools/video/youtube-downloader?url=${encodeURIComponent(trimmed)}`)
  }

  return (
    <>
      <SeoHead
        title="Free All Video Downloader – Download YouTube, Instagram, TikTok, Facebook & Pinterest Videos"
        description="Download videos from YouTube, Instagram, TikTok, Facebook, and Pinterest for free. No signup required. Choose MP4 quality or extract MP3 audio instantly."
        keywords="video downloader, youtube downloader, instagram downloader, tiktok downloader, facebook video downloader, pinterest downloader, mp4 download, mp3 download"
        canonical="/tools/video-downloader"
      />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-700 to-blue-800 text-white">
        {/* Decorative background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-cyan-300 rounded-full opacity-10 blur-3xl" />
          <div className="absolute top-1/2 right-0 w-80 h-80 bg-teal-300 rounded-full opacity-10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-300 rounded-full opacity-10 blur-3xl" />
          {/* Floating media icons */}
          {['4K', 'MP4', '▶️', '🎵', '📹'].map((icon, i) => (
            <div
              key={i}
              className="absolute text-white/10 font-black select-none"
              style={{
                fontSize: `${2 + (i % 3)}rem`,
                top: `${10 + i * 16}%`,
                left: i % 2 === 0 ? `${3 + i * 4}%` : undefined,
                right: i % 2 !== 0 ? `${3 + i * 4}%` : undefined,
                transform: `rotate(${-15 + i * 10}deg)`,
              }}
            >
              {icon}
            </div>
          ))}
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
            Free All Video Downloader
          </h1>
          <p className="text-lg text-cyan-100 mb-10">
            Support the Most Popular Platforms
          </p>

          {/* URL Input */}
          <form onSubmit={handleDownload} className="relative max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-white rounded-2xl border-4 border-white/20 shadow-2xl px-4 py-3">
              <span className="text-gray-400 text-xl flex-shrink-0">🌐</span>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Enter URL or Search"
                className="flex-1 text-gray-800 text-base outline-none bg-transparent placeholder:text-gray-400 font-medium"
              />
              <button
                type="submit"
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all whitespace-nowrap"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── WHY CHOOSE ────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Why Choose PDFChampion Video Downloader?</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-3">Download videos, audio, reels, shorts, and photos in a few clicks.</p>
        </div>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: '⚡', title: 'Instant Analysis', desc: 'Paste a link and get all available download formats in seconds.' },
            { icon: '📱', title: 'Works on Any Device', desc: 'Download on mobile, tablet, or desktop — no extra apps needed.' },
            { icon: '🌍', title: 'Wide Platform Support', desc: 'Supports YouTube, TikTok, Instagram, Facebook, Pinterest and more.' },
            { icon: '🎯', title: 'Flexible Quality', desc: 'Pick the quality you want — from 144p up to 1080p+ when available.' },
            { icon: '🔒', title: 'Privacy-First', desc: 'No data storage. Your links are processed privately and never saved.' },
            { icon: '🆓', title: 'Completely Free', desc: 'No signup, no watermarks, no limits. 100% free forever.' },
          ].map(f => (
            <div key={f.title} className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:shadow-md transition-all">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLATFORM TOOLS GRID ───────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          {PLATFORMS.map(platform => (
            <div key={platform.name} className="mb-14">
              {/* Platform header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} text-xl shadow-sm`}>
                  {platform.icon}
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                  {platform.name} Downloader
                </h2>
              </div>

              {/* Tools grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {platform.tools.map(tool => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className={`group flex items-center gap-3 rounded-xl border ${platform.border} ${platform.bg} px-5 py-4 transition-all hover:shadow-md hover:-translate-y-0.5 duration-200`}
                  >
                    <span className="text-xl flex-shrink-0">{tool.icon}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {tool.name}
                    </span>
                    <svg className="ml-auto h-4 w-4 text-gray-400 dark:text-gray-600 group-hover:text-teal-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SUPPORTED PLATFORMS ───────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gradient-to-b from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-3">Supported Platforms</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-10">Download videos from your favourite social media and video platforms</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {SUPPORTED_PLATFORMS.map(p => (
              <Link
                key={p.name}
                href={p.href}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-white dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <span className="text-4xl">{p.icon}</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 text-sm group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{p.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-center leading-snug">{p.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">How to Download a Video in 3 Simple Steps</h2>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', icon: '📋', title: 'Copy the Video Link', desc: 'Find the video on YouTube, TikTok, Instagram, or Facebook. Tap Share → Copy link.' },
            { step: '2', icon: '⬇️', title: 'Paste & Click Download', desc: 'Paste the copied URL into the box above, then click the Download button.' },
            { step: '3', icon: '💾', title: 'Choose Quality & Save', desc: 'Select your preferred format (MP4 or MP3) and quality, then save to your device.' },
          ].map(s => (
            <div key={s.step} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md mb-4">
                {s.step}
              </div>
              <div className="text-4xl mb-3">{s.icon}</div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
