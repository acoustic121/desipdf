import vm from 'node:vm'
import { existsSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'

export const config = { maxDuration: 60 }

// ── yt-dlp: find locally or download to /tmp on cold start ─────────────────────
const TMP_YTDLP = '/tmp/ytdlp-bin'

function findYtDlpSync() {
  const HOME = process.env.HOME || ''
  const candidates = [
    TMP_YTDLP,                                         // downloaded at runtime
    join(process.cwd(), 'bin', 'yt-dlp'),              // postinstall (Vercel)
    '/opt/homebrew/bin/yt-dlp',                        // macOS brew
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    join(HOME, '.local/bin/yt-dlp'),
  ]
  for (const p of candidates) { if (existsSync(p)) return p }
  try { const r = execFileSync('which', ['yt-dlp'], { encoding: 'utf8' }).trim(); if (r) return r } catch {}
  return null
}

// Module-level promise: starts download immediately when Lambda boots.
// By the time a real request arrives, the binary is usually ready.
const _ytDlpPromise = (async () => {
  const fast = findYtDlpSync()
  if (fast) return fast

  const p = process.platform, a = process.arch
  const url =
    p === 'linux' && a === 'arm64'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64'
    : p === 'linux'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
    : p === 'darwin'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
    : null
  if (!url) return null

  try {
    console.log(`[yt-dlp] Downloading for ${p}/${a}…`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    writeFileSync(TMP_YTDLP, Buffer.from(buf))
    chmodSync(TMP_YTDLP, 0o755)
    const ver = execFileSync(TMP_YTDLP, ['--version'], { encoding: 'utf8' }).trim()
    console.log(`[yt-dlp] Ready: ${ver}`)
    return TMP_YTDLP
  } catch (e) {
    console.error('[yt-dlp] Download failed:', e.message)
    return null
  }
})()

const getYtDlpPath = () => _ytDlpPromise

const webUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 OPR/121.0.0.0'

function customFetch(input, init) {
  let url = ''
  if (typeof input === 'string') {
    url = input
  } else if (input instanceof URL) {
    url = input.toString()
  } else if (input && typeof input === 'object') {
    if (typeof input.url === 'string') {
      url = input.url
    } else if (input.url && typeof input.url.toString === 'function') {
      url = input.url.toString()
    } else if (typeof input.toString === 'function') {
      url = input.toString()
    }
  }

  if (url && url.includes('googlevideo.com')) {
    init = init || {}
    let headers = init.headers || {}
    
    if (typeof headers.delete === 'function') {
      headers.delete('origin')
      headers.delete('Origin')
      headers.set('User-Agent', webUA)
    } else if (headers && typeof headers === 'object') {
      if (Array.isArray(headers)) {
        init.headers = headers.filter(h => h[0].toLowerCase() !== 'origin')
        const uaIndex = init.headers.findIndex(h => h[0].toLowerCase() === 'user-agent')
        if (uaIndex > -1) {
          init.headers[uaIndex] = ['User-Agent', webUA]
        } else {
          init.headers.push(['User-Agent', webUA])
        }
      } else {
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === 'origin') {
            delete headers[key]
          }
        }
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === 'user-agent') {
            delete headers[key]
          }
        }
        headers['User-Agent'] = webUA
      }
    }
    init.headers = headers
  }
  return globalThis.fetch(input, init)
}

let youtubeiPromise = null

async function initYoutubei() {
  if (youtubeiPromise) return youtubeiPromise

  youtubeiPromise = (async () => {
    const { Innertube, Platform } = await import('youtubei.js')

    Platform.shim.eval = function(data, args) {
      try {
        const context = vm.createContext({ ...args })
        return vm.runInContext(`(function() { ${data.output} })()`, context)
      } catch (err) {
        console.error('VM eval failed:', err)
        throw err
      }
    }

    return { Innertube }
  })()

  return youtubeiPromise
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return null
  const n = typeof bytes === 'string' ? parseInt(bytes) : Number(bytes)
  if (!n || n <= 0) return null
  const mb = n / (1024 * 1024)
  return mb < 1 ? `${Math.round(mb * 1000)} KB` : `${mb.toFixed(1)} MB`
}

function makeFilename(title = 'video', ext = 'mp4') {
  return `${(title).replace(/[^\w\s-]/g, '').trim().slice(0, 60).replace(/\s+/g, '_') || 'video'}.${ext}`
}

function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/instagram\.com/.test(url)) return 'instagram'
  if (/tiktok\.com|vm\.tiktok\.com/.test(url)) return 'tiktok'
  if (/facebook\.com|fb\.watch/.test(url)) return 'facebook'
  if (/pinterest\.(com|co\.uk|ca|au|fr|de)|pin\.it/.test(url)) return 'pinterest'
  return null
}

function extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// ─── Platform Fetchers ────────────────────────────────────────────────────────

async function fetchYouTube(url) {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('Invalid YouTube URL. Please paste a valid YouTube video link (e.g. youtube.com/watch?v=...)')

  // Innertube uses YouTube's own internal API — much more reliable than ytdl-core
  const { Innertube } = await initYoutubei()

  const yt = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: true,
    generate_session_locally: true,
    fetch: customFetch,
  })

  const info = await yt.getInfo(videoId, { client: 'MWEB' })

  if (!info || !info.basic_info) {
    throw new Error('Could not load video info. The video may be private, deleted, or unavailable in your region.')
  }

  // ── All formats: combined (muxed) + adaptive video-only + audio-only ─────────
  // Now that we use 1MB chunked downloading + ffmpeg merge, ALL qualities work.
  const title = info.basic_info.title || 'YouTube Video'
  const thumbnail = info.basic_info.thumbnail?.[0]?.url

  const combinedFormats = info.streaming_data?.formats || []
  const adaptiveFormats = info.streaming_data?.adaptive_formats || []

  // For each quality level, pick ONE format to show — prefer mp4 container (AV1/H.264)
  // since that's what the download endpoint selects when format:'mp4' is requested.
  // This ensures the displayed file size matches the actual downloaded size.
  const adaptiveVideoByQuality = {}
  for (const f of adaptiveFormats.filter(f => f.has_video && !f.has_audio && f.quality_label)) {
    const q = f.quality_label
    const isMp4 = (f.mime_type || '').includes('mp4')
    if (!adaptiveVideoByQuality[q] || isMp4) {
      adaptiveVideoByQuality[q] = f
    }
  }

  const allVideoFormats = [
    ...combinedFormats.filter(f => f.quality_label),
    ...Object.values(adaptiveVideoByQuality),
  ]

  const seenQ = new Set()
  const videoFormats = allVideoFormats
    .sort((a, b) => (parseInt(b.quality_label) || 0) - (parseInt(a.quality_label) || 0))
    .reduce((acc, f) => {
      if (!seenQ.has(f.quality_label)) {
        seenQ.add(f.quality_label)
        const isCombined = f.has_audio !== false
        acc.push({
          quality: f.quality_label,
          ext: 'mp4',
          size: formatBytes(f.content_length),
          downloadType: isCombined ? 'video' : 'videoOnly',
          downloadQuality: f.quality_label,
          filename: makeFilename(title, 'mp4'),
        })
      }
      return acc
    }, [])
    .slice(0, 8)


  // Audio formats: adaptive audio-only streams (MP3 via 1MB chunk download)
  const seenA = new Set()
  const audioFormats = adaptiveFormats
    .filter(f => f.has_audio && !f.has_video)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
    .reduce((acc, f) => {
      const bitrate = Math.round((f.bitrate || f.average_bitrate || 0) / 1000)
      if (bitrate > 0 && !seenA.has(bitrate)) {
        seenA.add(bitrate)
        acc.push({
          quality: `${bitrate}kbps`,
          ext: 'mp3',
          size: formatBytes(f.content_length),
          downloadType: 'audio',
          downloadQuality: 'best',
          filename: makeFilename(title, 'mp3'),
        })
      }
      return acc
    }, [])
    .slice(0, 4)

  if (!videoFormats.length && !audioFormats.length) {
    throw new Error('No downloadable formats found. The video may be private, age-restricted, or region-blocked.')
  }

  return { title, thumbnail, platform: 'youtube', videoFormats, audioFormats }


}

// ── Generic yt-dlp info extractor (Instagram, TikTok, Facebook, etc.) ───────────
async function fetchWithYtDlp(url, platform) {
  const ytDlpPath = await getYtDlpPath()
  if (!ytDlpPath) throw new Error(`yt-dlp not available for ${platform}`)

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json', '--no-warnings', '--no-playlist',
      '--skip-download',
      url,
    ]

    console.log(`[yt-dlp info] ${platform}: ${url.slice(0, 60)}`)
    const proc = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = '', stderr = ''
    proc.stdout.on('data', d => { stdout += d })
    proc.stderr.on('data', d => { stderr += d })

    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.slice(-300) || `yt-dlp exited ${code}`))
        return
      }
      try {
        const firstLine = stdout.trim().split('\n')[0]
        const data = JSON.parse(firstLine)

        const title = data.title || data.fulltitle || `${platform} Video`
        const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || null
        const height = data.height || data.requested_formats?.[0]?.height || null
        const fileSizeApprox = data.filesize_approx || data.filesize || null

        resolve({
          title, thumbnail, platform,
          videoFormats: [{
            quality: height ? `${height}p` : 'HD',
            ext: 'mp4',
            size: fileSizeApprox ? formatBytes(fileSizeApprox) : null,
            downloadType: 'ytdlp',
            downloadQuality: 'best',
            filename: makeFilename(title, 'mp4'),
          }],
          audioFormats: [],
        })
      } catch (e) {
        reject(new Error(`yt-dlp JSON parse failed: ${e.message}`))
      }
    })

    proc.on('error', reject)
  })
}

async function fetchInstagram(url) {
  const ytDlpPath = await getYtDlpPath()
  if (ytDlpPath) {
    return await fetchWithYtDlp(url, 'instagram')
  }
  // Legacy fallback (unreliable — embed page frequently broken by Instagram)
  throw new Error('Could not extract Instagram video. Please try again later.')
}

async function fetchTikTok(url) {
  const ytDlpPath = await getYtDlpPath()
  if (ytDlpPath) {
    try {
      return await fetchWithYtDlp(url, 'tiktok')
    } catch (err) {
      console.warn('[TikTok] yt-dlp failed, falling back to tikwm.com:', err.message.slice(0, 100))
    }
  }

  // Fallback: tikwm.com API
  // NOTE: tikwm.com sometimes returns relative URLs — always prefix the domain
  const fixUrl = (u) => {
    if (!u) return null
    if (u.startsWith('http://') || u.startsWith('https://')) return u
    return `https://www.tikwm.com${u.startsWith('/') ? '' : '/'}${u}`
  }

  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&count=12&cursor=0&web=1&hd=1`
  const resp = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  const data = await resp.json()
  if (!data?.data) throw new Error('Could not fetch TikTok video info. Ensure the video is public.')

  const { play, wmplay, music, title, cover } = data.data
  const videoFormats = []
  const playUrl = fixUrl(play), wmUrl = fixUrl(wmplay)
  if (playUrl) videoFormats.push({ quality: 'HD (No Watermark)', ext: 'mp4', size: null, directUrl: playUrl, downloadType: 'direct', filename: makeFilename(title, 'mp4') })
  if (wmUrl)  videoFormats.push({ quality: 'SD (With Watermark)', ext: 'mp4', size: null, directUrl: wmUrl,  downloadType: 'direct', filename: makeFilename(title, 'mp4') })
  const audioFormats = []
  const musicUrl = fixUrl(music)
  if (musicUrl) audioFormats.push({ quality: 'Original Audio', ext: 'mp3', size: null, directUrl: musicUrl, downloadType: 'direct', filename: makeFilename(title, 'mp3') })

  return { title: title || 'TikTok Video', thumbnail: cover || null, platform: 'tiktok', videoFormats, audioFormats }
}

async function fetchFacebook(url) {
  const ytDlpPath = await getYtDlpPath()
  if (ytDlpPath) {
    try {
      return await fetchWithYtDlp(url, 'facebook')
    } catch (err) {
      console.warn('[Facebook] yt-dlp failed, falling back to embed scraping:', err.message.slice(0, 100))
    }
  }

  // Fallback: Facebook plugin embed scraping
  const resp = await fetch(
    `https://www.facebook.com/plugins/video/embed/?href=${encodeURIComponent(url)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' } }
  )
  const html = await resp.text()
  const hdMatch = html.match(/"hd_src":"([^"]+)"/)
  const sdMatch = html.match(/"sd_src":"([^"]+)"/)
  const titleMatch = html.match(/<title>([^<]+)<\/title>/)

  const videoFormats = []
  if (hdMatch) videoFormats.push({ quality: 'HD', ext: 'mp4', size: null, directUrl: hdMatch[1].replace(/\\\//g, '/'), downloadType: 'direct', filename: 'facebook_video_hd.mp4' })
  if (sdMatch) videoFormats.push({ quality: 'SD', ext: 'mp4', size: null, directUrl: sdMatch[1].replace(/\\\//g, '/'), downloadType: 'direct', filename: 'facebook_video_sd.mp4' })
  if (!videoFormats.length) throw new Error('Could not extract Facebook video. The video may be private or require login.')

  const title = titleMatch ? titleMatch[1].replace(' | Facebook', '').trim() : 'Facebook Video'
  return { title, thumbnail: null, platform: 'facebook', videoFormats, audioFormats: [] }
}

async function fetchPinterest(url) {
  const ytDlpPath = await getYtDlpPath()
  if (ytDlpPath) {
    try {
      return await fetchWithYtDlp(url, 'pinterest')
    } catch (err) {
      console.warn('[Pinterest] yt-dlp failed (may be image pin), falling back:', err.message.slice(0, 100))
    }
  }

  // Fallback: HTML scraping (for image/GIF pins)
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
  })
  const html = await resp.text()
  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  const title = titleMatch ? titleMatch[1].replace(' | Pinterest', '').trim() : 'Pinterest Media'

  const videoMatch = html.match(/https:\/\/v\.pinimg\.com\/[^"'\s>]+\.mp4[^"'\s>]*/i)
  if (videoMatch) {
    const videoUrl = videoMatch[0].replace(/\\u0026/g, '&').replace(/&amp;/g, '&')
    return { title, thumbnail: null, platform: 'pinterest', videoFormats: [{ quality: 'Original', ext: 'mp4', size: null, directUrl: videoUrl, downloadType: 'direct', filename: makeFilename(title, 'mp4') }], audioFormats: [] }
  }
  const gifMatch = html.match(/https:\/\/i\.pinimg\.com\/[^"'\s>]+\.gif[^"'\s>]*/i)
  if (gifMatch) {
    return { title, thumbnail: gifMatch[0], platform: 'pinterest', videoFormats: [{ quality: 'GIF', ext: 'gif', size: null, directUrl: gifMatch[0], downloadType: 'direct', filename: makeFilename(title, 'gif') }], audioFormats: [] }
  }
  const imgMatch = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"'\s>]+\.(jpg|jpeg|png|webp)/i)
  if (imgMatch) {
    return { title, thumbnail: imgMatch[0], platform: 'pinterest', videoFormats: [{ quality: 'Original Image', ext: imgMatch[1], size: null, directUrl: imgMatch[0], downloadType: 'direct', filename: makeFilename(title, imgMatch[1]) }], audioFormats: [] }
  }
  throw new Error('Could not extract media from this Pinterest URL')
}


// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL parameter is required' })

  const platform = detectPlatform(url)
  if (!platform) return res.status(400).json({ error: 'Unsupported platform. Supported: YouTube, Instagram, TikTok, Facebook, Pinterest' })

  try {
    let result
    switch (platform) {
      case 'youtube':   result = await fetchYouTube(url);   break
      case 'instagram': result = await fetchInstagram(url); break
      case 'tiktok':    result = await fetchTikTok(url);    break
      case 'facebook':  result = await fetchFacebook(url);  break
      case 'pinterest': result = await fetchPinterest(url); break
    }
    res.setHeader('Cache-Control', 'no-store')
    res.json(result)
  } catch (err) {
    console.error(`[video/info][${platform}]`, err.message)
    res.status(500).json({ error: err.message || 'Failed to extract video info. Please try again.' })
  }
}
