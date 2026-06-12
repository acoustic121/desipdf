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

  // Try multiple clients — Vercel IPs get blocked for some clients but not others
  // IOS client is most reliable in 2025 (doesn't require po_token)
  const clientsToTry = ['IOS', 'MWEB', 'TV_EMBEDDED']
  let info = null
  let lastClientErr = null

  for (const client of clientsToTry) {
    try {
      const candidate = await yt.getInfo(videoId, { client })
      if (candidate?.streaming_data?.formats?.length || candidate?.streaming_data?.adaptive_formats?.length) {
        info = candidate
        console.log(`[YouTube] Innertube client ${client} succeeded`)
        break
      }
      console.warn(`[YouTube] Innertube client ${client} returned empty formats, trying next…`)
    } catch (e) {
      lastClientErr = e
      console.warn(`[YouTube] Innertube client ${client} failed: ${e.message.slice(0, 80)}`)
    }
  }

  // If Innertube got basic_info but no formats from any client, still capture title/thumbnail
  if (!info) {
    try { info = await yt.getInfo(videoId, { client: 'MWEB' }) } catch {}
  }

  if (!info || !info.basic_info) {
    // Innertube completely failed — jump straight to yt-dlp
    console.warn('[YouTube] Innertube failed entirely, trying yt-dlp…')
    const ytDlpPath = await getYtDlpPath()
    if (ytDlpPath) return await fetchYouTubeViaYtDlp(url, ytDlpPath, null, null)
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
    // Innertube returned empty formats for all clients — fall back to yt-dlp, then Invidious
    console.warn('[YouTube] All Innertube clients returned empty formats — trying yt-dlp fallback…')
    const ytDlpPath = await getYtDlpPath()
    if (ytDlpPath) {
      try {
        return await fetchYouTubeViaYtDlp(url, ytDlpPath, title, thumbnail)
      } catch (ytErr) {
        console.error('[YouTube] yt-dlp fallback failed:', ytErr.message)
      }
    }
    // Final fallback: Invidious API
    console.warn('[YouTube] Trying Invidious API as final fallback…')
    try {
      return await fetchYouTubeViaInvidious(videoId, title, thumbnail)
    } catch (invErr) {
      console.error('[YouTube] Invidious fallback failed:', invErr.message)
    }
    throw new Error('No downloadable formats found. The video may be private, age-restricted, or region-blocked.')
  }

  return { title, thumbnail, platform: 'youtube', videoFormats, audioFormats }

}

// ── Invidious API fallback (replaces Cobalt which now requires JWT auth) ────────
// Invidious is an open-source YouTube frontend with public community instances.
// Returns combined video+audio stream URLs that don't require merging.
async function fetchYouTubeViaInvidious(videoId, infoTitle, infoThumb) {
  const t = infoTitle || 'YouTube Video'

  // Try multiple Invidious instances in order (community-maintained public servers)
  // Updated June 2026 — tested for availability from datacenter IPs
  const instances = [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://invidious.privacyredirect.com',
    'https://inv.in.projectsegfau.lt',
    'https://invidious.asir.dev',
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://invidious.privacydev.net',
  ]

  for (const instance of instances) {
    try {
      console.log(`[Invidious] Trying ${instance}…`)
      const resp = await fetch(
        `${instance}/api/v1/videos/${videoId}?fields=title,videoThumbnails,formatStreams,adaptiveFormats`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        }
      )
      if (!resp.ok) { console.warn(`[Invidious] ${instance} HTTP ${resp.status}`); continue }
      const data = await resp.json()

      const title = data.title || t
      const thumb = data.videoThumbnails?.find(t => t.quality === 'maxres')?.url
        || data.videoThumbnails?.[0]?.url || infoThumb

      // formatStreams = combined video+audio (no merge needed) — typically 360p/720p
      const seenQ = new Set()
      const videoFormats = (data.formatStreams || [])
        .filter(f => f.type?.startsWith('video/mp4') && f.qualityLabel)
        .sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0))
        .reduce((acc, f) => {
          if (!seenQ.has(f.qualityLabel)) {
            seenQ.add(f.qualityLabel)
            acc.push({
              quality: f.qualityLabel,
              ext: 'mp4',
              size: null,
              downloadType: 'direct',
              directUrl: f.url,  // Invidious proxy URL — stable for the session
              filename: makeFilename(title, 'mp4'),
            })
          }
          return acc
        }, [])

      if (!videoFormats.length) { console.warn(`[Invidious] ${instance} returned no video formats`); continue }

      console.log(`[Invidious] Success via ${instance}: ${videoFormats.length} format(s)`)
      return { title, thumbnail: thumb, platform: 'youtube', videoFormats, audioFormats: [] }
    } catch (e) {
      console.warn(`[Invidious] ${instance} failed:`, e.message.slice(0, 80))
    }
  }

  throw new Error('All Invidious instances failed. Please try again later or use a different video.')
}




// ── YouTube via yt-dlp (fallback when Innertube is blocked on Vercel) ──────────
async function fetchYouTubeViaYtDlp(url, ytDlpPath, infoTitle, infoThumb) {
  // Write cookies once upfront
  const cookiePath = '/tmp/yt-cookies.txt'
  const rawCookies = process.env.YOUTUBE_COOKIES || ''
  // Sanitize: remove \r (Windows line endings), trim whitespace, ensure Netscape header
  const cookieContent = rawCookies
    .replace(/\r\n/g, '\n')  // Windows CRLF → Unix LF
    .replace(/\r/g, '\n')    // stray \r → LF
    .trim()                   // remove leading/trailing blank lines
  if (cookieContent) {
    try {
      // Ensure proper Netscape cookie file header (required by yt-dlp)
      const cookieBody = cookieContent.startsWith('# Netscape')
        ? cookieContent
        : '# Netscape HTTP Cookie File\n' + cookieContent
      require('fs').writeFileSync(cookiePath, cookieBody + '\n')
      console.log('[yt-dlp] Cookie file written:', cookieBody.split('\n').length, 'lines')
    } catch (e) {
      console.warn('[yt-dlp] Failed to write cookie file:', e.message)
    }
  }
  const hasCookies = cookieContent.length > 100 && require('fs').existsSync(cookiePath)
  console.log(`[yt-dlp] Cookies: ${hasCookies ? 'YES (' + cookieContent.length + ' bytes)' : 'NO'}`)

  // Helper: run one yt-dlp attempt with given extra args
  function attempt(extraArgs, label) {
    return new Promise((resolve, reject) => {
      const args = [
        '-J', '--skip-download',
        '--no-warnings', '--no-playlist',
        '--socket-timeout', '8',
        '--retries', '1',
        '--force-ipv4',
        ...extraArgs,
        url,
      ]
      console.log(`[yt-dlp] Trying ${label}…`)
      const proc = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = '', stderr = ''
      proc.stdout.on('data', d => { stdout += d })
      proc.stderr.on('data', d => { stderr += d })
      proc.on('close', code => {
        const errSnippet = stderr.replace(/\n/g, ' ').slice(-200)
        console.log(`[yt-dlp] ${label} exit=${code} out=${stdout.length}b err=${errSnippet}`)
        if (code !== 0) { reject(new Error(stderr.slice(-300) || 'exit ' + code)); return }
        if (!stdout.trim()) { reject(new Error('no output')); return }
        try { resolve(JSON.parse(stdout.trim())) }
        catch { reject(new Error('JSON parse failed')) }
      })
      proc.on('error', reject)
    })
  }

  // Strategies in priority order
  const strategies = [
    { label: 'tv_embedded', args: ['--extractor-args', 'youtube:player_client=tv_embedded'] },
    ...(hasCookies ? [{ label: 'web+cookies', args: ['--extractor-args', 'youtube:player_client=web', '--cookies', cookiePath] }] : []),
    { label: 'ios', args: ['--extractor-args', 'youtube:player_client=ios'] },
    { label: 'android', args: ['--extractor-args', 'youtube:player_client=android'] },
  ]

  let lastErr = null
  for (const { label, args } of strategies) {
    try {
      const data = await attempt(args, label)
      const title = data.title || data.fulltitle || infoTitle || 'YouTube Video'
      const thumbnail = data.thumbnail || infoThumb || null
      const fmts = data.formats || []
      console.log(`[yt-dlp] ${label} success: ${fmts.length} total formats`)

      const seenH = new Set()
      const videoFormats = fmts
        .filter(f => f.vcodec !== 'none' && f.height && f.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0))
        .reduce((acc, f) => {
          if (!seenH.has(f.height)) {
            seenH.add(f.height)
            acc.push({
              quality: `${f.height}p`, ext: 'mp4',
              size: f.filesize || f.filesize_approx ? formatBytes(f.filesize || f.filesize_approx) : null,
              downloadType: 'ytdlp', downloadQuality: `${f.height}p`,
              filename: makeFilename(title, 'mp4'),
            })
          }
          return acc
        }, [])
        .slice(0, 6)

      if (!videoFormats.length) {
        videoFormats.push({ quality: 'Best Available', ext: 'mp4', size: null,
          downloadType: 'ytdlp', downloadQuality: 'best', filename: makeFilename(title, 'mp4') })
      }
      return { title, thumbnail, platform: 'youtube', videoFormats, audioFormats: [] }
    } catch (e) {
      console.warn(`[yt-dlp] ${label} failed:`, e.message.slice(0, 150))
      lastErr = e
    }
  }
  throw new Error('yt-dlp all strategies failed: ' + (lastErr?.message?.slice(0, 200) || 'unknown'))
}


// ── Generic yt-dlp info extractor (Instagram, TikTok, Facebook, Pinterest) ─────
async function fetchWithYtDlp(url, platform) {
  const ytDlpPath = await getYtDlpPath()
  if (!ytDlpPath) throw new Error(`yt-dlp not available for ${platform}`)

  return new Promise((resolve, reject) => {
    // Instagram-specific args to improve extraction reliability
    const platformArgs = platform === 'instagram'
      ? ['--extractor-args', 'instagram:api=graphql']
      : []

    const args = [
      '--dump-json', '--no-warnings', '--no-playlist',
      '--skip-download',
      ...platformArgs,
      url,
    ]

    console.log(`[yt-dlp info] ${platform}: ${url.slice(0, 60)}`)
    const proc = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = '', stderr = ''
    proc.stdout.on('data', d => { stdout += d })
    proc.stderr.on('data', d => { stderr += d })

    proc.on('close', code => {
      if (code !== 0) {
        // Provide friendlier errors for common Instagram failures
        const errMsg = stderr.slice(-400) || `yt-dlp exited ${code}`
        if (platform === 'instagram' && /login|rate.limit|private|protected/i.test(errMsg)) {
          reject(new Error('This Instagram post is private or requires login. Please try a public post URL.'))
        } else {
          reject(new Error(errMsg))
        }
        return
      }

      const raw = stdout.trim()
      if (!raw) {
        reject(new Error(`yt-dlp returned no data for this ${platform} URL. The post may be private or unavailable.`))
        return
      }

      // yt-dlp can output multiple JSON lines (e.g. carousel / playlist).
      // Find the first line that parses successfully.
      let data = null
      const lines = raw.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          data = JSON.parse(trimmed)
          break
        } catch {
          // try next line
        }
      }

      if (!data) {
        reject(new Error(`yt-dlp JSON parse failed: could not parse response for this ${platform} URL.`))
        return
      }

      try {
        const title = data.title || data.fulltitle || `${platform} Video`
        const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || null
        const height = data.height || data.requested_formats?.[0]?.height || null
        const fileSizeApprox = data.filesize_approx || data.filesize || null

        // ─ For social platforms: extract CDN URL directly from yt-dlp JSON.
        // This avoids needing to re-run yt-dlp at download time AND avoids ffmpeg.
        // yt-dlp JSON has either data.url (single combined format) or data.formats[].
        const fmts = data.formats || []

        // Find best combined format (video + audio in one stream) — no merge needed
        const combined = fmts
          .filter(f => f.url && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none')
          .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))

        const best = combined[0]  // Best combined format

        // TikTok CDN URLs are session/IP-restricted — proxying them from Node.js returns 403.
        // For TikTok, always use yt-dlp re-download (downloadType: 'ytdlp') at download time.
        // Instagram/Facebook fbcdn.net URLs work fine for direct proxying.
        const canProxyDirectly = platform !== 'tiktok'
        const directUrl = canProxyDirectly ? (best?.url || data.url) : null

        if (directUrl) {
          const finalHeight = best?.height || height
          const finalExt   = best?.ext   || data.ext || 'mp4'
          const finalSize  = best?.filesize || best?.filesize_approx || fileSizeApprox
          resolve({
            title, thumbnail, platform,
            videoFormats: [{
              quality:      finalHeight ? `${finalHeight}p` : 'HD',
              ext:          finalExt,
              size:         finalSize ? formatBytes(finalSize) : null,
              downloadType: 'direct',   // Proxy the CDN URL — no yt-dlp re-run needed
              directUrl,
              filename:     makeFilename(title, finalExt),
            }],
            audioFormats: [],
          })
        } else {
          // TikTok or no combined format found — re-download with yt-dlp at download time
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
        }
      } catch (e) {
        reject(new Error(`yt-dlp response processing failed: ${e.message}`))
      }
    })

    proc.on('error', reject)
  })
}

// ── Instagram fallback: extract full-res media from page/embed sources ────────
// og:image is always a center-cropped square thumbnail — we need display_url
// from Instagram's embedded JSON which has the actual uncropped full-res image.
async function fetchInstagramOG(url) {
  const match = url.match(/instagram\.com\/(?:p|reel|tv|stories\/[^/]+)\/([A-Za-z0-9_-]+)/)
  if (!match) throw new Error('Invalid Instagram URL. Please use a direct post link (e.g. instagram.com/p/...).')
  const shortcode = match[1]

  const unesc = s => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\\\/g, '\\')
    .replace(/\\n/g, '').replace(/\\t/g, '')

  // ── Helper: parse the best result from an HTML blob ──────────────────────
  function parseFromHtml(html) {
    // 1) Try display_url from embedded JSON — this is the FULL-RES UNCROPPED image
    //    Instagram embeds JSON data in <script> tags on the page
    const displayUrlPatterns = [
      /"display_url"\s*:\s*"([^"]+)"/,
      /"display_src"\s*:\s*"([^"]+)"/,
      /,"display_url":"([^"]+)"/,
    ]
    for (const pat of displayUrlPatterns) {
      const m = html.match(pat)
      if (m) {
        const imgUrl = unesc(m[1])
        if (imgUrl.startsWith('http') && (imgUrl.includes('cdninstagram') || imgUrl.includes('scontent') || imgUrl.includes('fbcdn'))) {
          console.log('[Instagram] Found display_url (full-res) in page JSON')
          return { type: 'image', url: imgUrl }
        }
      }
    }

    // 2) Try video_url from embedded JSON
    const videoUrlPatterns = [
      /"video_url"\s*:\s*"([^"]+)"/,
      /"video_src"\s*:\s*"([^"]+)"/,
    ]
    for (const pat of videoUrlPatterns) {
      const m = html.match(pat)
      if (m) {
        const vidUrl = unesc(m[1])
        if (vidUrl.startsWith('http')) {
          console.log('[Instagram] Found video_url in page JSON')
          return { type: 'video', url: vidUrl }
        }
      }
    }

    // 3) OG video
    const ogVideo = html.match(/<meta[^>]+property="og:video(?::secure_url)?"[^>]+content="([^"]+)"/) ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:video/)
    if (ogVideo) {
      const vidUrl = unesc(ogVideo[1])
      if (vidUrl.startsWith('http')) {
        console.log('[Instagram] Found video via og:video')
        return { type: 'video', url: vidUrl }
      }
    }

    // 4) OG image as last resort (will be cropped square, but better than nothing)
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    if (ogImage) {
      const imgUrl = unesc(ogImage[1])
      if (imgUrl.startsWith('http') && (imgUrl.includes('cdninstagram') || imgUrl.includes('scontent') || imgUrl.includes('fbcdn'))) {
        console.log('[Instagram] Using og:image fallback (may be square crop)')
        return { type: 'image', url: imgUrl }
      }
    }

    return null
  }

  // ── Helper: extract title from HTML ──────────────────────────────────────
  function parseTitle(html) {
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/) ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/) ||
                    html.match(/<title>([^<]+)<\/title>/)
    return ogTitle
      ? unesc(ogTitle[1]).replace(/ on Instagram.*/, '').replace(/@\w+:\s*/, '').slice(0, 80).trim()
      : 'Instagram Media'
  }

  function parseThumbnail(html) {
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
                    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
    return ogImage ? unesc(ogImage[1]) : null
  }

  // ── Strategy 1: /media/?size=l — direct redirect to full-res image ────────
  // This endpoint often redirects to the original uncropped image for public posts
  try {
    const mediaResp = await fetch(`https://www.instagram.com/p/${shortcode}/media/?size=l`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
      redirect: 'follow',
    })
    if (mediaResp.ok) {
      const finalUrl = mediaResp.url
      const ct = mediaResp.headers.get('content-type') || ''
      if (finalUrl && finalUrl !== `https://www.instagram.com/p/${shortcode}/media/?size=l` && ct.startsWith('image/')) {
        console.log('[Instagram] Got full-res image via /media/?size=l redirect')
        return {
          title: 'Instagram Photo', thumbnail: finalUrl, platform: 'instagram',
          videoFormats: [{
            quality: 'Original', ext: 'jpg', size: null,
            downloadType: 'direct', directUrl: finalUrl,
            filename: makeFilename('Instagram Photo', 'jpg'),
          }],
          audioFormats: [],
        }
      }
    }
  } catch (e) {
    console.warn('[Instagram] /media/?size=l failed:', e.message.slice(0, 60))
  }

  // ── Strategy 2-4: Fetch page with various bot UAs, look for display_url ──
  const attempts = [
    {
      fetchUrl: `https://www.instagram.com/p/${shortcode}/`,
      headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    },
    {
      fetchUrl: `https://www.instagram.com/p/${shortcode}/`,
      headers: { 'User-Agent': 'Twitterbot/1.0', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    },
    {
      fetchUrl: `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    },
  ]

  for (const attempt of attempts) {
    try {
      const resp = await fetch(attempt.fetchUrl, { headers: attempt.headers })
      if (!resp.ok) continue
      const html = await resp.text()

      const title = parseTitle(html)
      const thumbnail = parseThumbnail(html)
      const found = parseFromHtml(html)

      if (found) {
        const isVideo = found.type === 'video'
        return {
          title, thumbnail: thumbnail || (found.type === 'image' ? found.url : null), platform: 'instagram',
          videoFormats: [{
            quality: isVideo ? 'HD' : 'Original',
            ext: isVideo ? 'mp4' : 'jpg',
            size: null,
            downloadType: 'direct',
            directUrl: found.url,
            filename: makeFilename(title, isVideo ? 'mp4' : 'jpg'),
          }],
          audioFormats: [],
        }
      }
    } catch (e) {
      console.warn(`[Instagram] Attempt failed (${attempt.fetchUrl.slice(0, 50)}):`, e.message.slice(0, 60))
    }
  }

  throw new Error('Could not extract this Instagram post. It may be private, require login, or be a carousel/multi-image post. Please try a single public photo or video post.')
}


async function fetchInstagram(url) {
  const ytDlpPath = await getYtDlpPath()
  if (ytDlpPath) {
    try {
      return await fetchWithYtDlp(url, 'instagram')
    } catch (err) {
      console.warn('[Instagram] yt-dlp failed, trying OG fallback:', err.message.slice(0, 120))
    }
  }
  // Fallback: OG meta tags via Facebook/Twitter bot crawler UA
  return await fetchInstagramOG(url)
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
