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

let proxyAgent = null
const proxyUrl = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY
if (proxyUrl) {
  try {
    const { ProxyAgent } = await import('undici')
    proxyAgent = new ProxyAgent(proxyUrl)
    console.log('[proxy] Loaded ProxyAgent for:', proxyUrl)
  } catch (e) {
    console.error('[proxy] Failed to load ProxyAgent:', e.message)
  }
}

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

  init = init || {}
  if (proxyAgent) {
    init.dispatcher = proxyAgent
  }

  if (url && url.includes('googlevideo.com')) {
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

  console.log('[YouTube] Fetching metadata via parallel Invidious API...')
  try {
    return await fetchYouTubeViaInvidious(videoId, null, null)
  } catch (invErr) {
    console.error('[YouTube] Invidious fetch failed:', invErr.message)
    throw new Error('Could not load video info. The video may be private, deleted, or unavailable. Please try a different video.')
  }
}

// ── Invidious API fallback (replaces Cobalt which now requires JWT auth) ────────
// Invidious is an open-source YouTube frontend with public community instances.
// Returns combined video+audio stream URLs that don't require merging.
async function fetchYouTubeViaInvidious(videoId, infoTitle, infoThumb) {
  const t = infoTitle || 'YouTube Video'

  // Expanded fallback list of instances:
  let instances = [
    'https://invidious.nerdvpn.de',
    'https://invidious.privacyredirect.com',
    'https://inv.in.projectsegfau.lt',
    'https://invidious.asir.dev',
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://invidious.privacydev.net',
    'https://inv.tux.pizza',
    'https://invidious.no-logs.com',
    'https://inv.vern.cc',
    'https://invidious.io.lol',
    'https://invidious.flokinet.to',
    'https://invidious.projectsegfau.lt',
    'https://invidious.slipfox.xyz',
    'https://inv.us.projectsegfau.lt',
    'https://invidious.lunar.icu'
  ]

  try {
    const listResp = await fetch('https://api.invidious.io/instances.json')
    if (listResp.ok) {
      const listData = await listResp.json()
      if (Array.isArray(listData)) {
        // filter for HTTPS instances that have API enabled and high monitor uptime ratio
        const dynamicInstances = listData
          .filter(item => {
            const stats = item[1]
            return stats && stats.api && stats.type === 'https' && stats.uri
          })
          .map(item => item[1].uri)
        if (dynamicInstances.length > 0) {
          instances = [...new Set([...dynamicInstances, ...instances])]
        }
      }
    }
  } catch (e) {
    console.warn('[Invidious] Failed to fetch dynamic instances list:', e.message)
  }

  // Shuffle the list to distribute request load and avoid Cloudflare IP bans
  instances.sort(() => Math.random() - 0.5)

  // Try top 12 instances in parallel to ensure fast sub-second resolution
  const candidates = instances.slice(0, 12)
  console.log(`[Invidious] Querying ${candidates.length} instances in parallel for ID ${videoId}...`)

  const fetchPromise = (instance) => {
    return new Promise(async (resolve, reject) => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000) // 4s timeout per request

        const resp = await fetch(
          `${instance}/api/v1/videos/${videoId}?fields=title,videoThumbnails,formatStreams,adaptiveFormats`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json',
            },
            signal: controller.signal
          }
        )
        clearTimeout(timeoutId)

        if (!resp.ok) {
          reject(new Error(`HTTP ${resp.status}`))
          return
        }

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
                directUrl: f.url,
                filename: makeFilename(title, 'mp4'),
              })
            }
            return acc
          }, [])

        if (!videoFormats.length) {
          reject(new Error('No video formats available'))
          return
        }

        // adaptiveFormats has audio-only streams
        const seenA = new Set()
        const audioFormats = (data.adaptiveFormats || [])
          .filter(f => f.type?.startsWith('audio/') && f.bitrate)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
          .reduce((acc, f) => {
            const bitrate = Math.round((f.bitrate || 0) / 1000)
            if (bitrate > 0 && !seenA.has(bitrate)) {
              seenA.add(bitrate)
              const ext = f.type?.includes('webm') ? 'webm' : 'm4a'
              acc.push({
                quality: `${bitrate}kbps`,
                ext: ext,
                size: null,
                downloadType: 'direct',
                directUrl: f.url,
                filename: makeFilename(title, ext),
              })
            }
            return acc
          }, [])
          .slice(0, 4)

        console.log(`[Invidious] Succeeded via ${instance}`)
        resolve({ title, thumbnail: thumb, platform: 'youtube', videoFormats, audioFormats })
      } catch (e) {
        reject(e)
      }
    })
  }

  try {
    return await Promise.any(candidates.map(fetchPromise))
  } catch (aggregateError) {
    console.error('[Invidious] All parallel queries failed:', aggregateError.errors)
    throw new Error('All Invidious instances failed to resolve video info. The video may be private or unavailable.')
  }
}




function convertToNetscape(raw) {
  const input = raw.trim()
  if (!input) return ''

  // 1. If it's already Netscape format
  if (input.includes('# Netscape') || (input.includes('.youtube.com') && input.split('\n').some(line => line.split(/\s+/).length >= 6))) {
    return input.startsWith('# Netscape') ? input : '# Netscape HTTP Cookie File\n' + input
  }

  // 2. If it's JSON format
  if (input.startsWith('[') && input.endsWith(']')) {
    try {
      const arr = JSON.parse(input)
      if (Array.isArray(arr)) {
        let out = '# Netscape HTTP Cookie File\n'
        for (const item of arr) {
          const domain = item.domain || '.youtube.com'
          const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE'
          const path = item.path || '/'
          const secure = item.secure ? 'TRUE' : 'FALSE'
          const expiration = item.expirationDate || item.expiry || Math.round(Date.now() / 1000) + 31536000
          const name = item.name
          const value = item.value
          if (name && value !== undefined) {
            out += `${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`
          }
        }
        return out
      }
    } catch (e) {
      console.warn('[cookies] Failed to parse JSON cookies:', e.message)
    }
  }

  // 3. If it's raw Header format (key=value; key=value)
  if (input.includes('=') && (input.includes(';') || !input.includes('\n'))) {
    let out = '# Netscape HTTP Cookie File\n'
    const pairs = input.split(';')
    const expiry = Math.round(Date.now() / 1000) + 31536000
    for (const pair of pairs) {
      const idx = pair.indexOf('=')
      if (idx > -1) {
        const name = pair.slice(0, idx).trim()
        const value = pair.slice(idx + 1).trim()
        if (name && value) {
          out += `.youtube.com\tTRUE\t/\tTRUE\t${expiry}\t${name}\t${value}\n`
        }
      }
    }
    return out
  }

  return input.startsWith('# Netscape') ? input : '# Netscape HTTP Cookie File\n' + input
}

// ── YouTube via yt-dlp (fallback when Innertube is blocked on Vercel) ──────────
async function fetchYouTubeViaYtDlp(url, ytDlpPath, infoTitle, infoThumb) {
  // Write cookies once upfront
  const cookiePath = '/tmp/yt-cookies.txt'
  const rawCookies = process.env.YOUTUBE_COOKIES || ''
  
  const cookieContent = convertToNetscape(rawCookies)
  if (cookieContent) {
    try {
      writeFileSync(cookiePath, cookieContent + '\n')
      console.log('[yt-dlp] Cookie file written:', cookieContent.split('\n').length, 'lines')
    } catch (e) {
      console.warn('[yt-dlp] Failed to write cookie file:', e.message)
    }
  }
  const hasCookies = cookieContent.length > 100 && existsSync(cookiePath)
  console.log(`[yt-dlp] Cookies: ${hasCookies ? 'YES (' + cookieContent.length + ' bytes)' : 'NO'}`)

  const proxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY

  // Helper: run one yt-dlp attempt with given extra args
  function attempt(extraArgs, label) {
    return new Promise((resolve, reject) => {
      const args = [
        '-J', '--skip-download',
        '--no-warnings', '--no-playlist',
        '--socket-timeout', '8',
        '--retries', '1',
        '--force-ipv4',
        '--no-check-formats',
        ...(proxy ? ['--proxy', proxy] : []),
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

  const poToken = process.env.YOUTUBE_PO_TOKEN
  const visitorData = process.env.YOUTUBE_VISITOR_DATA
  let poTokenExt = ''
  if (poToken) poTokenExt += `;po_token=${poToken}`
  if (visitorData) poTokenExt += `;visitor_data=${visitorData}`

  // Strategies in priority order:
  // 1. web+cookies+po_token (if both cookies and po_token are present)
  // 2. web+cookies
  // 3. web+po_token (if po_token is present)
  // 4. tv_embedded: no-cookie client that bypasses bot check on non-datacenter IPs
  // 5. ios / android: mobile clients as last resort
  const strategies = [
    ...(hasCookies && poToken ? [{ label: 'web+cookies+po_token', args: ['--extractor-args', `youtube:player_client=web${poTokenExt}`, '--cookies', cookiePath] }] : []),
    ...(hasCookies ? [{ label: 'web+cookies', args: ['--extractor-args', 'youtube:player_client=web', '--cookies', cookiePath] }] : []),
    ...(poToken ? [{ label: 'web+po_token', args: ['--extractor-args', `youtube:player_client=web${poTokenExt}`] }] : []),
    { label: 'tv_embedded', args: ['--extractor-args', `youtube:player_client=tv_embedded${poTokenExt}`] },
    { label: 'ios', args: ['--extractor-args', `youtube:player_client=ios${poTokenExt}`] },
    { label: 'android', args: ['--extractor-args', `youtube:player_client=android${poTokenExt}`] },
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
              quality: `${f.height}p`,
              ext: 'mp4',
              size: f.filesize || f.filesize_approx ? formatBytes(f.filesize || f.filesize_approx) : null,
              downloadType: 'direct',
              directUrl: f.url,
              filename: makeFilename(title, 'mp4'),
            })
          }
          return acc
        }, [])
        .slice(0, 6)

      const seenA = new Set()
      const audioFormats = fmts
        .filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.url)
        .sort((a, b) => (b.abr || b.bitrate || 0) - (a.abr || a.bitrate || 0))
        .reduce((acc, f) => {
          const bitrate = Math.round(f.abr || (f.bitrate || 0) / 1000)
          if (bitrate > 0 && !seenA.has(bitrate)) {
            seenA.add(bitrate)
            const ext = f.ext === 'webm' ? 'webm' : 'm4a'
            acc.push({
              quality: `${bitrate}kbps`,
              ext: ext,
              size: f.filesize || f.filesize_approx ? formatBytes(f.filesize || f.filesize_approx) : null,
              downloadType: 'direct',
              directUrl: f.url,
              filename: makeFilename(title, ext),
            })
          }
          return acc
        }, [])
        .slice(0, 4)

      if (!videoFormats.length && !audioFormats.length) {
        videoFormats.push({
          quality: 'Best Available',
          ext: 'mp4',
          size: null,
          downloadType: 'direct',
          directUrl: fmts[0]?.url || null,
          filename: makeFilename(title, 'mp4'),
        })
      }
      return { title, thumbnail, platform: 'youtube', videoFormats, audioFormats }
    } catch (e) {
      console.warn(`[yt-dlp] ${label} failed:`, e.message.slice(0, 150))
      lastErr = e
    }
  }
  throw new Error('yt-dlp all strategies failed: ' + (lastErr?.message?.slice(0, 200) || 'unknown'))
}


// ── Generic yt-dlp info extractor (Instagram, Facebook, Pinterest) ─────
async function fetchWithYtDlp(url, platform) {
  const ytDlpPath = await getYtDlpPath()
  if (!ytDlpPath) throw new Error(`yt-dlp not available for ${platform}`)

  return new Promise((resolve, reject) => {
    // Instagram-specific args to improve extraction reliability
    const platformArgs = platform === 'instagram'
      ? ['--extractor-args', 'instagram:api=graphql']
      : []

    const proxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY
    const args = [
      '--dump-json', '--no-warnings', '--no-playlist',
      '--skip-download',
      ...(proxy ? ['--proxy', proxy] : []),
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

        // Instagram/Facebook fbcdn.net URLs work fine for direct proxying.
        const canProxyDirectly = true
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
          // No combined format found — re-download with yt-dlp at download time
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
  if (!platform) return res.status(400).json({ error: 'Unsupported platform. Supported: YouTube, Instagram, Facebook, Pinterest' })

  try {
    let result
    switch (platform) {
      case 'youtube':   result = await fetchYouTube(url);   break
      case 'instagram': result = await fetchInstagram(url); break

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
