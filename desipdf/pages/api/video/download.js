/**
 * /api/video/download
 *
 * YouTube high-quality downloads (1080p+) use yt-dlp as a subprocess.
 * yt-dlp properly handles YouTube's CDN IP restrictions and rate limits by
 * using the correct client tokens and request patterns. It avoids the ~30 MB
 * per-session limit that our youtubei.js server-side approach hits.
 *
 * Other formats (audio, combined video) and non-YouTube platforms continue
 * to use the existing youtubei.js / direct proxy approach.
 */

import vm from 'node:vm'
import { createWriteStream, createReadStream, unlink, existsSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export const config = {
  maxDuration: 300,
  api: { responseLimit: false },
}

const webUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'

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

function fetchWithProxy(input, init) {
  init = init || {}
  if (proxyAgent) {
    init.dispatcher = proxyAgent
  }
  return globalThis.fetch(input, init)
}

/// ── yt-dlp: find locally or download to /tmp on Lambda cold start ────────────────
const TMP_YTDLP = '/tmp/ytdlp-bin'

function findYtDlpSync() {
  const HOME = process.env.HOME || ''
  const candidates = [
    TMP_YTDLP,
    join(process.cwd(), 'bin', 'yt-dlp'),
    '/opt/homebrew/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    join(HOME, '.local/bin/yt-dlp'),
  ]
  for (const p of candidates) { if (existsSync(p)) return p }
  try { const r = execFileSync('which', ['yt-dlp'], { encoding: 'utf8' }).trim(); if (r) return r } catch {}
  return null
}

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
    const res = await fetchWithProxy(url)
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

/// ── ffmpeg: find locally or download to /tmp on Lambda cold start ────────────
const TMP_FFMPEG = '/tmp/ffmpeg-bin'
let _ffmpegPromise = null

async function getFfmpegPath() {
  if (ffmpegPath && existsSync(ffmpegPath)) return ffmpegPath
  if (existsSync(TMP_FFMPEG)) return TMP_FFMPEG
  
  if (_ffmpegPromise) return _ffmpegPromise
  
  _ffmpegPromise = (async () => {
    const p = process.platform, a = process.arch
    const archName = a === 'arm64' ? 'arm64' : 'x64'
    const osName = p === 'win32' ? 'win32' : p
    const ext = p === 'win32' ? '.exe' : ''
    
    // We use eugeneware/ffmpeg-static binaries which are highly compatible
    const url = `https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-${osName}-${archName}${ext}`
    
    try {
      console.log(`[ffmpeg] Downloading for ${p}/${a} from ${url}…`)
      const res = await fetchWithProxy(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      writeFileSync(TMP_FFMPEG, Buffer.from(buf))
      chmodSync(TMP_FFMPEG, 0o755)
      
      const ver = execFileSync(TMP_FFMPEG, ['-version'], { encoding: 'utf8' }).toString().split('\n')[0]
      console.log(`[ffmpeg] Ready: ${ver}`)
      return TMP_FFMPEG
    } catch (e) {
      console.error('[ffmpeg] Download failed:', e.message)
      return null
    }
  })()
  return _ffmpegPromise
}

// ── Download video with yt-dlp ────────────────────────────────────────
async function ytDlpVideo(videoId, quality, outputPath) {
  const ytDlpPath = await getYtDlpPath()
  if (!ytDlpPath) throw new Error('yt-dlp not available')

  // Check if ffmpeg is accessible (dynamically fetch if on Vercel)
  const runtimeFfmpeg = await getFfmpegPath()
  const ffmpegOk = runtimeFfmpeg && existsSync(runtimeFfmpeg)
  const finalFfmpegPath = ffmpegOk ? runtimeFfmpeg : ffmpegPath
  const height = parseInt(quality?.replace('p', '') || '1080', 10)

  // Cookies + web client = authenticated browser session
  // No cookies + tv_embedded = best format coverage without auth
  const cookiePath = '/tmp/yt-cookies.txt'
  const rawCookies = process.env.YOUTUBE_COOKIES || ''
  const cookieContent = rawCookies
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
  if (cookieContent) {
    try {
      const cookieBody = cookieContent.startsWith('# Netscape')
        ? cookieContent
        : '# Netscape HTTP Cookie File\n' + cookieContent
      writeFileSync(cookiePath, cookieBody + '\n')
    } catch (e) {
      console.warn('[yt-dlp] Failed to write cookie file:', e.message)
    }
  }
  const hasCookies = cookieContent.length > 100 && existsSync(cookiePath)
  const poToken = process.env.YOUTUBE_PO_TOKEN
  const visitorData = process.env.YOUTUBE_VISITOR_DATA
  const playerClient = (hasCookies || poToken) ? 'web' : 'tv_embedded'

  let poTokenExt = ''
  if (poToken) poTokenExt += `;po_token=${poToken}`
  if (visitorData) poTokenExt += `;visitor_data=${visitorData}`

  // Without ffmpeg: use combined format (no merge needed, max ~720p)
  // With ffmpeg: use separate video+audio streams (supports 1080p+)
  const formatSel = ffmpegOk
    ? `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`
    : `best[height<=${height}][ext=mp4]/best[height<=${height}]/best[ext=mp4]/best`

  const proxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY

  return new Promise((resolve, reject) => {
    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '--format', formatSel,
      '--output', outputPath,
      '--extractor-args', `youtube:player_client=${playerClient}${poTokenExt}`,
      '--force-ipv4',
      '--no-playlist', '--no-warnings',
      '--progress', '--newline',
      ...(proxy ? ['--proxy', proxy] : []),
      ...(hasCookies ? ['--cookies', cookiePath] : []),
      // Only pass ffmpeg-location if we know ffmpeg is accessible
      ...(ffmpegOk ? ['--merge-output-format', 'mp4', '--ffmpeg-location', finalFfmpegPath] : []),
    ]
    console.log(`[yt-dlp] Video: ${quality} (ffmpeg: ${ffmpegOk ? 'yes' : 'no'}, client: ${playerClient}${poToken ? ', po_token: yes' : ''})`)
    const proc = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stderrLines = []
    proc.stdout.on('data', d => process.stdout.write(`[yt-dlp] ${d}`))
    proc.stderr.on('data', d => { process.stderr.write(`[yt-dlp] ${d}`); stderrLines.push(String(d)) })
    proc.on('close', code => {
      if (code === 0) { console.log(`[yt-dlp] ✅ Video done → ${outputPath}`); resolve({ ffmpegOk }) }
      else reject(new Error(`yt-dlp video failed: ${stderrLines.join('').slice(-400) || `exit ${code}`}`))
    })
    proc.on('error', reject)
  })
}

// ── Download audio with yt-dlp, extract to MP3 ───────────────────────────────
async function ytDlpAudio(videoId, outputPath) {
  const ytDlpPath = await getYtDlpPath()
  if (!ytDlpPath) throw new Error('yt-dlp not available')

  const runtimeFfmpeg = await getFfmpegPath()
  const ffmpegOk = runtimeFfmpeg && existsSync(runtimeFfmpeg)
  const finalFfmpegPath = ffmpegOk ? runtimeFfmpeg : ffmpegPath

  const cookiePath = '/tmp/yt-cookies.txt'
  const rawCookies = process.env.YOUTUBE_COOKIES || ''
  const cookieContent = rawCookies
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
  if (cookieContent) {
    try {
      const cookieBody = cookieContent.startsWith('# Netscape')
        ? cookieContent
        : '# Netscape HTTP Cookie File\n' + cookieContent
      writeFileSync(cookiePath, cookieBody + '\n')
    } catch (e) {
      console.warn('[yt-dlp] Failed to write cookie file:', e.message)
    }
  }
  const hasCookies = cookieContent.length > 100 && existsSync(cookiePath)
  const poToken = process.env.YOUTUBE_PO_TOKEN
  const visitorData = process.env.YOUTUBE_VISITOR_DATA
  const playerClient = (hasCookies || poToken) ? 'web' : 'tv_embedded'

  let poTokenExt = ''
  if (poToken) poTokenExt += `;po_token=${poToken}`
  if (visitorData) poTokenExt += `;visitor_data=${visitorData}`

  const proxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY

  return new Promise((resolve, reject) => {
    const args = ffmpegOk
      ? [
          `https://www.youtube.com/watch?v=${videoId}`,
          '--format', 'bestaudio/best',
          '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '192K',
          '--output', outputPath,
          '--extractor-args', `youtube:player_client=${playerClient}${poTokenExt}`,
          '--force-ipv4',
          '--no-playlist', '--no-warnings',
          '--ffmpeg-location', finalFfmpegPath,
          '--progress', '--newline',
          ...(proxy ? ['--proxy', proxy] : []),
          ...(hasCookies ? ['--cookies', cookiePath] : []),
        ]
      : [
          // Without ffmpeg: download best audio stream as-is (m4a/opus)
          `https://www.youtube.com/watch?v=${videoId}`,
          '--format', 'bestaudio[ext=m4a]/bestaudio/best[ext=mp4]/best',
          '--output', outputPath.replace(/\.mp3$/, '.m4a'),
          '--extractor-args', `youtube:player_client=${playerClient}${poTokenExt}`,
          '--force-ipv4',
          '--no-playlist', '--no-warnings',
          '--progress', '--newline',
          ...(proxy ? ['--proxy', proxy] : []),
          ...(hasCookies ? ['--cookies', cookiePath] : []),
        ]
    console.log(`[yt-dlp] Audio (ffmpeg: ${ffmpegOk}, client: ${playerClient})`)
    const proc = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stderrLines = []
    proc.stdout.on('data', d => process.stdout.write(`[yt-dlp] ${d}`))
    proc.stderr.on('data', d => { process.stderr.write(`[yt-dlp] ${d}`); stderrLines.push(String(d)) })
    proc.on('close', code => {
      if (code === 0) { console.log(`[yt-dlp] ✅ Audio done → ${outputPath}`); resolve({ ffmpegOk }) }
      else reject(new Error(`yt-dlp audio failed: ${stderrLines.join('').slice(-400) || `exit ${code}`}`))
    })
    proc.on('error', reject)
  })
}

// ── Extract URL string from fetch input ───────────────────────────────────────
function extractUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input?.url) return typeof input.url === 'string' ? input.url : String(input.url)
  if (typeof input?.toString === 'function') return input.toString()
  return ''
}

function customFetch(input, init) {
  const url = extractUrl(input)
  if (url && url.includes('googlevideo.com')) {
    init = { ...(init || {}), headers: { 'User-Agent': webUA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' } }
  }
  return fetchWithProxy(input, init)
}

let youtubeiPromise = null
async function initYoutubei() {
  if (youtubeiPromise) return youtubeiPromise
  youtubeiPromise = (async () => {
    const { Innertube, Platform } = await import('youtubei.js')
    Platform.shim.eval = function (data, args) {
      try { return vm.runInContext(`(function(){${data.output}})()`, vm.createContext({ ...args })) }
      catch (e) { console.error('VM eval:', e); throw e }
    }
    return { Innertube }
  })()
  return youtubeiPromise
}

function extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

async function getDecipheredUrl(info, downloadOpts) {
  let captured = null
  const { Innertube } = await initYoutubei()
  const captureFetch = (input, init) => {
    const url = extractUrl(input)
    if (url && url.includes('googlevideo.com')) {
      if (!captured) captured = url
      return Promise.resolve(new Response(
        new ReadableStream({ start(c) { c.close() } }),
        { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '0' } }
      ))
    }
    return fetchWithProxy(input, init)
  }
  const poToken = process.env.YOUTUBE_PO_TOKEN
  const visitorData = process.env.YOUTUBE_VISITOR_DATA
  const yt = await Innertube.create({
    lang: 'en',
    location: 'US',
    retrieve_player: true,
    generate_session_locally: true,
    fetch: captureFetch,
    ...(poToken ? { po_token: poToken } : {}),
    ...(visitorData ? { visitor_data: visitorData } : {}),
  })
  const captureInfo = await yt.getInfo(info.basic_info.id, { client: 'MWEB' })
  try { await captureInfo.download(downloadOpts) } catch {}
  if (!captured) throw new Error('Could not decipher CDN URL')
  return captured.replace(/&range=\d+-\d+/, '')
}

// ── Chunked download (for audio and fallback) ─────────────────────────────────
async function downloadWithRefresh(getUrl, writable, knownSize = 0) {
  const URL_QUOTA_BYTES = 24 * 1024 * 1024
  const CHUNK = 1024 * 1024
  const HDR = { 'User-Agent': webUA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' }
  let offset = 0, urlBytesUsed = 0
  let currentUrl = await getUrl()

  while (true) {
    if (urlBytesUsed >= URL_QUOTA_BYTES) {
      currentUrl = await getUrl()
      urlBytesUsed = 0
    }
    if (knownSize > 0 && offset >= knownSize) break

    const end = offset + CHUNK - 1
    let chunkUrl = `${currentUrl}&range=${offset}-${end}`
    let resp = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await fetchWithProxy(chunkUrl, { headers: HDR })
        if (resp.ok) break
        if (resp.status === 403) {
          if (offset === 0) throw new Error('CDN 403 on first chunk')
          if (attempt === 0) {
            currentUrl = await getUrl(); urlBytesUsed = 0
            chunkUrl = `${currentUrl}&range=${offset}-${end}`
            continue
          }
          resp = null
        }
        break
      } catch (err) {
        if (attempt === 1) throw err
        await new Promise(r => setTimeout(r, 400))
      }
    }

    if (!resp || !resp.ok) { if (offset === 0) throw new Error('Failed to start download'); break }
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length === 0) break
    const ok = writable.write(buf)
    if (!ok) await new Promise(r => writable.once('drain', r))
    offset += buf.length
    urlBytesUsed += buf.length
    if (buf.length < CHUNK) break
  }
  console.log(`[dl] ✅ ${(offset / 1e6).toFixed(1)} MB / ${knownSize > 0 ? (knownSize / 1e6).toFixed(1) + ' MB' : '?'}`)
}

async function downloadToFile(getUrl, filePath, knownSize = 0) {
  const fileStream = createWriteStream(filePath)
  const closePromise = new Promise((resolve, reject) => {
    fileStream.on('finish', resolve); fileStream.on('error', reject)
  })
  try {
    await downloadWithRefresh(getUrl, fileStream, knownSize)
    fileStream.end(); await closePromise
  } catch (err) { fileStream.destroy(); throw err }
}

// ── Merge with ffmpeg, pipe to response ──────────────────────────────────────
async function mergeWithFfmpeg(videoFile, audioFile, res, req) {
  const runtimeFfmpeg = await getFfmpegPath()
  const finalFfmpegPath = (runtimeFfmpeg && existsSync(runtimeFfmpeg)) ? runtimeFfmpeg : ffmpegPath

  return new Promise((resolve, reject) => {
    const ff = spawn(finalFfmpegPath, [
      '-y', '-i', videoFile, '-i', audioFile,
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    ff.stdout.pipe(res, { end: false })
    ff.stderr.on('data', d => process.stderr.write(`[ffmpeg] ${d}`))
    req.on('close', () => { try { ff.kill('SIGTERM') } catch {} })
    ff.on('close', code => (code === 0 || code === null) ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))
    ff.on('error', reject)
  })
}

// ── Pipe /tmp file to HTTP response ──────────────────────────────────────────
function pipeFileToResponse(filePath, res, req) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.pipe(res, { end: false })
    req.on('close', () => { try { stream.destroy() } catch {} })
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const {
    videoUrl,
    platform,
    filename = 'video.mp4',
    directUrl,
    downloadType,
    downloadQuality,
  } = req.query

  if (!videoUrl && !directUrl) return res.status(400).json({ error: 'videoUrl or directUrl required' })
  const safeFilename = (filename || 'video.mp4').replace(/"/g, '')

  try {
    // ── yt-dlp generic download (TikTok, Pinterest, Instagram/Facebook fallback) ──
    if (downloadType === 'ytdlp' && videoUrl) {
      const ytDlpPath = await getYtDlpPath()
      if (!ytDlpPath) return res.status(500).json({ error: 'yt-dlp is not available on this server' })
      
      const runtimeFfmpeg = await getFfmpegPath()
      const ffmpegOk = runtimeFfmpeg && existsSync(runtimeFfmpeg)
      const finalFfmpegPath = ffmpegOk ? runtimeFfmpeg : ffmpegPath
      
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      // Use %(ext)s template so yt-dlp picks the extension
      const outTemplate = join(tmpdir(), `ytdl_${id}.%(ext)s`)
      console.log(`[download] yt-dlp generic: ${videoUrl.slice(0, 60)} (ffmpeg: ${ffmpegOk})`)
      try {
        await new Promise((resolve, reject) => {
          const formatStr = ffmpegOk
            ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best'
            : 'best[ext=mp4]/best[ext=webm]/bestvideo[ext=mp4]/bestvideo/best'
            
          const proxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY
          const args = [
            videoUrl,
            '--format', formatStr,
            '--output', outTemplate,
            '--no-playlist', '--no-warnings',
            '--progress', '--newline',
            ...(proxy ? ['--proxy', proxy] : []),
            ...(ffmpegOk ? ['--merge-output-format', 'mp4', '--ffmpeg-location', finalFfmpegPath] : []),
          ]
          const proc = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
          const stderr = []
          proc.stdout.on('data', d => process.stdout.write(`[yt-dlp] ${d}`))
          proc.stderr.on('data', d => { process.stderr.write(`[yt-dlp] ${d}`); stderr.push(String(d)) })
          proc.on('close', code => code === 0 ? resolve() : reject(new Error(`yt-dlp failed: ${stderr.join('').slice(-400) || `exit ${code}`}`)))
          proc.on('error', reject)
        })
        // Find the actual output file (yt-dlp picks the extension via %(ext)s template)
        const possibleExts = ['mp4', 'webm', 'mkv', 'm4v', 'mov', 'avi']
        const actualFile = possibleExts.map(ext => join(tmpdir(), `ytdl_${id}.${ext}`)).find(f => existsSync(f))
        if (!actualFile) throw new Error('yt-dlp did not produce output file')
        const ext = actualFile.split('.').pop()
        const ct = ext === 'webm' ? 'video/webm' : 'video/mp4'
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename.replace(/\.\w+$/, `.${ext}`)}"`)
        res.setHeader('Content-Type', ct)
        res.setHeader('Cache-Control', 'no-store')
        await pipeFileToResponse(actualFile, res, req)
      } finally {
        // Clean up all possible temp file variants
        ['mp4','webm','mkv','m4v','mov','avi'].forEach(ext => unlink(join(tmpdir(), `ytdl_${id}.${ext}`), () => {}))
      }
      if (!res.writableEnded) res.end()
      return
    }

    // ── YouTube ───────────────────────────────────────────────────────────────
    if (platform === 'youtube' && videoUrl) {
      const videoId = extractYouTubeId(videoUrl)
      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

      const isAudio = downloadType === 'audio'
      const isHighQuality = downloadType === 'videoOnly' ||
        (['1080p', '1440p', '2160p', '240p', '144p'].includes(downloadQuality) && downloadType === 'video')


      // ── High-quality video: use yt-dlp (combined format if no ffmpeg) ─────────
      if (isHighQuality || downloadType === 'ytdlp') {
        const ytDlpPath = await getYtDlpPath()
        if (ytDlpPath || downloadType === 'ytdlp') {
          if (!ytDlpPath) return res.status(500).json({ error: 'yt-dlp not available' })
          console.log(`[download] Using yt-dlp for ${downloadQuality}`)
          const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const outFile = join(tmpdir(), `ytdl_${id}.mp4`)
          const outWebm = outFile.replace(/\.mp4$/, '.webm')
          const outMkv  = outFile.replace(/\.mp4$/, '.mkv')
          try {
            await ytDlpVideo(videoId, downloadQuality, outFile)
            // yt-dlp may produce .webm/.mkv if ffmpeg unavailable
            const actualFile = existsSync(outFile) ? outFile
              : existsSync(outWebm) ? outWebm
              : existsSync(outMkv)  ? outMkv
              : null
            if (!actualFile) throw new Error('yt-dlp did not produce output file')
            const ext = actualFile.endsWith('.webm') ? 'webm' : actualFile.endsWith('.mkv') ? 'mkv' : 'mp4'
            const ct  = ext === 'webm' ? 'video/webm' : 'video/mp4'
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename.replace(/\.\w+$/, `.${ext}`)}"`)
            res.setHeader('Content-Type', ct)
            res.setHeader('Cache-Control', 'no-store')
            console.log('[download] Streaming yt-dlp output to browser…')
            await pipeFileToResponse(actualFile, res, req)
            console.log('[download] ✅ Done')
          } finally {
            unlink(outFile, () => {})
            unlink(outWebm, () => {})
            unlink(outMkv,  () => {})
          }
          if (!res.writableEnded) res.end()
          return
        }
      }

      // ── Fallback: youtubei.js (works for ≤30 MB files / lower qualities) ──
      const { Innertube } = await initYoutubei()
      const poToken = process.env.YOUTUBE_PO_TOKEN
      const visitorData = process.env.YOUTUBE_VISITOR_DATA
      const yt = await Innertube.create({
        lang: 'en',
        location: 'US',
        retrieve_player: true,
        generate_session_locally: true,
        fetch: customFetch,
        ...(poToken ? { po_token: poToken } : {}),
        ...(visitorData ? { visitor_data: visitorData } : {}),
      })
      const info = await yt.getInfo(videoId, { client: 'MWEB' })
      console.log(`[download] "${info.basic_info.title?.slice(0, 50)}" | type:${downloadType} q:${downloadQuality}`)

      // ── Audio: use yt-dlp (extract to proper MP3, or m4a if no ffmpeg) ────────
      if (isAudio) {
        const ytDlpPath = await getYtDlpPath()
        if (ytDlpPath) {
          const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          const outMp3 = join(tmpdir(), `ytda_${id}.mp3`)
          const outM4a = outMp3.replace(/\.mp3$/, '.m4a')
          try {
            const { ffmpegOk } = await ytDlpAudio(videoId, outMp3)
            const actualFile = existsSync(outMp3) ? outMp3 : existsSync(outM4a) ? outM4a : null
            if (!actualFile) throw new Error('yt-dlp did not produce audio file')
            const isM4a = actualFile.endsWith('.m4a')
            const audioExt = isM4a ? 'm4a' : 'mp3'
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename.replace(/\.\w+$/, `.${audioExt}`)}"`)
            res.setHeader('Content-Type', isM4a ? 'audio/mp4' : 'audio/mpeg')
            res.setHeader('Cache-Control', 'no-store')
            await pipeFileToResponse(actualFile, res, req)
          } finally {
            unlink(outMp3, () => {})
            unlink(outM4a, () => {})
          }
          if (!res.writableEnded) res.end()
          return
        }
      }

      // ── Audio (Fallback) ──────────────────────────────────────────────────
      if (isAudio) {
        const aOpts = { type: 'audio', quality: 'best', format: 'any', client: 'MWEB' }
        const firstUrl = await getDecipheredUrl(info, aOpts)
        const clen = parseInt(new URL(firstUrl).searchParams.get('clen') || '0', 10) || 0
        let firstUsed = false
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Cache-Control', 'no-store')
        await downloadWithRefresh(
          () => { if (!firstUsed) { firstUsed = true; return firstUrl } return getDecipheredUrl(info, aOpts) },
          res, clen
        )
        if (!res.writableEnded) res.end()
        return
      }

      // ── High-quality without yt-dlp (fallback) ────────────────────────────
      if (isHighQuality) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const videoTmp = join(tmpdir(), `ytv_${id}.mp4`)
        const audioTmp = join(tmpdir(), `yta_${id}.m4a`)
        try {
          const vOpts = { type: 'video', quality: downloadQuality, format: 'mp4', client: 'MWEB' }
          const firstVideoUrl = await getDecipheredUrl(info, vOpts)
          const vClen = parseInt(new URL(firstVideoUrl).searchParams.get('clen') || '0', 10) || 0
          let vFirst = false
          await downloadToFile(() => { if (!vFirst) { vFirst = true; return firstVideoUrl } return getDecipheredUrl(info, vOpts) }, videoTmp, vClen)

          const aOpts = { type: 'audio', quality: 'best', format: 'any', client: 'MWEB' }
          const firstAudioUrl = await getDecipheredUrl(info, aOpts)
          const aClen = parseInt(new URL(firstAudioUrl).searchParams.get('clen') || '0', 10) || 0
          let aFirst = false
          await downloadToFile(() => { if (!aFirst) { aFirst = true; return firstAudioUrl } return getDecipheredUrl(info, aOpts) }, audioTmp, aClen)

          res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
          res.setHeader('Content-Type', 'video/mp4')
          res.setHeader('Cache-Control', 'no-store')
          await mergeWithFfmpeg(videoTmp, audioTmp, res, req)
        } finally {
          unlink(videoTmp, () => {}); unlink(audioTmp, () => {})
        }
        if (!res.writableEnded) res.end()
        return
      }

      // ── Combined muxed stream (360p, 480p, 720p) ──────────────────────────
      const combinedStream = await info.download({ type: 'video+audio', quality: 'best', format: 'any', client: 'MWEB' })
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Cache-Control', 'no-store')
      const reader = combinedStream.getReader()
      req.on('close', () => { try { reader.cancel() } catch {} })
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!res.writable) break
        const ok = res.write(Buffer.from(value))
        if (!ok) await new Promise(r => res.once('drain', r))
      }
      if (!res.writableEnded) res.end()
      return
    }

    // ── Other platforms ───────────────────────────────────────────────────────
    const targetUrl = directUrl || videoUrl
    if (!targetUrl) return res.status(400).json({ error: 'No download URL provided' })
    const upstream = await fetchWithProxy(targetUrl, {
      headers: { 'User-Agent': webUA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://www.google.com/' },
    })
    if (!upstream.ok) return res.status(502).json({ error: `Upstream CDN returned ${upstream.status}` })
    const cType = upstream.headers.get('content-type') || 'video/mp4'
    const cLen = upstream.headers.get('content-length')
    res.setHeader('Content-Type', cType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
    res.setHeader('Cache-Control', 'no-store')
    if (cLen) res.setHeader('Content-Length', cLen)
    const reader = upstream.body.getReader()
    req.on('close', () => { try { reader.cancel() } catch {} })
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!res.writable) break
      const ok = res.write(value)
      if (!ok) await new Promise(r => res.once('drain', r))
    }
    if (!res.writableEnded) res.end()

  } catch (err) {
    console.error('[video/download]', platform, err.message)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download failed. Please try again.' })
    } else if (!res.writableEnded) {
      res.end()
    }
  }
}
