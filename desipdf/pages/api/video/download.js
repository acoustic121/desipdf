import vm from 'node:vm'
import { createWriteStream, unlink } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export const config = {
  maxDuration: 300,
  api: { responseLimit: false },
}

const webUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
// YouTube CDN allows range chunks ≤ ~2MB. Its default (10MB) triggers 403.
const CHUNK_SIZE = 1024 * 1024 // 1 MB per chunk — stays within CDN limit

// ── Extract URL string from fetch input ────────────────────────────────────────
function extractUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input?.url) return typeof input.url === 'string' ? input.url : String(input.url)
  if (typeof input?.toString === 'function') return input.toString()
  return ''
}

// ── Normal customFetch: strips all headers for googlevideo CDN ─────────────────
function customFetch(input, init) {
  const url = extractUrl(input)
  if (url && url.includes('googlevideo.com')) {
    init = {
      ...(init || {}),
      headers: { 'User-Agent': webUA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' },
    }
  }
  return globalThis.fetch(input, init)
}

// ── Lazy-load youtubei.js ─────────────────────────────────────────────────────
let youtubeiPromise = null
async function initYoutubei() {
  if (youtubeiPromise) return youtubeiPromise
  youtubeiPromise = (async () => {
    const { Innertube, Platform } = await import('youtubei.js')
    Platform.shim.eval = function (data, args) {
      try {
        const ctx = vm.createContext({ ...args })
        return vm.runInContext(`(function() { ${data.output} })()`, ctx)
      } catch (err) {
        console.error('VM eval failed:', err)
        throw err
      }
    }
    return { Innertube }
  })()
  return youtubeiPromise
}

// ── Extract YouTube video ID ─────────────────────────────────────────────────
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

// ── Get deciphered CDN base URL for a given format via fetch interception ──────
//
// YouTube CDN URLs are signed — they must be deciphered server-side.
// YouTubei.js does this internally when download() is called, then uses its own
// chunked fetcher with 10MB chunks which triggers 403. We intercept the call,
// capture the deciphered URL, and do our own 1MB chunked download instead.
async function getDecipheredUrl(info, downloadOpts) {
  let captured = null
  const { Innertube } = await initYoutubei()

  // Create a new Innertube instance with a "capture" fetch:
  // When googlevideo.com is called, save the URL and return a minimal response.
  const captureFetch = (input, init) => {
    const url = extractUrl(input)
    if (url && url.includes('googlevideo.com')) {
      if (!captured) captured = url
      // Return a fake OK response so youtubei.js doesn't throw
      return Promise.resolve(new Response(
        new ReadableStream({ start(c) { c.close() } }),
        { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '0' } }
      ))
    }
    return globalThis.fetch(input, init)
  }

  const yt = await Innertube.create({
    lang: 'en', location: 'US',
    retrieve_player: true,
    generate_session_locally: true,
    fetch: captureFetch,
  })
  // Use the SAME session player as the original info (share the inner state)
  // by re-fetching info with the capture instance
  const captureInfo = await yt.getInfo(info.basic_info.id, { client: 'MWEB' })
  try { await captureInfo.download(downloadOpts) } catch {}

  if (!captured) throw new Error('Could not decipher CDN URL for the requested format')
  // Strip the range parameter that youtubei.js appended — we'll add our own
  return captured.replace(/&range=\d+-\d+/, '')
}

// ── Download from CDN URL in safe 1MB chunks, write to a Node.js writable ──────
//
// YouTube CDN blocks requests with range ≥ ~5MB (returns 403).
// Fetching in 1MB chunks consistently returns 200.
//
// IMPORTANT: do NOT pass the req-close abort signal here during /tmp downloads.
// The browser hasn't received any bytes yet, so it may drop the connection early,
// triggering the abort and truncating the download at ~30 MB.
// Instead we use no signal (let each chunk complete) and retry on transient failures.
async function downloadInChunks(baseUrl, writable, streamAbortSignal) {
  // Extract content-length from the URL's clen param (best-effort)
  let totalSize = 0
  try {
    const u = new URL(baseUrl)
    totalSize = parseInt(u.searchParams.get('clen') || '0', 10) || 0
  } catch {}

  let offset = 0
  const headers = { 'User-Agent': webUA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' }
  const MAX_RETRIES = 3

  while (true) {
    // Only abort if explicitly streaming to browser was cancelled (not during /tmp download)
    if (streamAbortSignal?.aborted) break

    const end = offset + CHUNK_SIZE - 1
    const chunkUrl = `${baseUrl}&range=${offset}-${end}`

    // Fetch without abort signal — each individual chunk must complete fully.
    // Aborting mid-chunk causes truncation; we handle failures via retry instead.
    let resp = null
    let lastErr = null
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        resp = await globalThis.fetch(chunkUrl, { headers })
        if (resp.ok) break
        // 403 at offset > 0 sometimes means we've reached the end of available data
        if (!resp.ok && offset > 0 && resp.status === 403) {
          resp = null // treat as end-of-stream
          break
        }
        // Other non-ok at offset 0 = real failure
        if (!resp.ok && offset === 0) {
          throw new Error(`CDN returned ${resp.status} for first chunk`)
        }
      } catch (err) {
        lastErr = err
        if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }

    if (!resp || !resp.ok) {
      if (offset === 0) throw lastErr || new Error('Failed to fetch first chunk after retries')
      break // Treat as end of stream for partial failures mid-download
    }

    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length === 0) break

    const canContinue = writable.write(buf)
    if (!canContinue) await new Promise(r => writable.once('drain', r))

    offset += buf.length
    if (totalSize > 0 && offset >= totalSize) break
    if (buf.length < CHUNK_SIZE) break // Last chunk received
  }

  console.log(`[chunks] Downloaded ${(offset / 1024 / 1024).toFixed(1)} MB (expected: ${(totalSize / 1024 / 1024).toFixed(1)} MB)`)
}

// ── Download to a tmp file ────────────────────────────────────────────────────
// Note: no abortSignal passed — the browser hasn't received any data yet so
// req.close can fire prematurely. We let each /tmp download complete fully.
async function downloadToFile(baseUrl, filePath) {
  const fileStream = createWriteStream(filePath)
  const closePromise = new Promise((res, rej) => {
    fileStream.on('finish', res)
    fileStream.on('error', rej)
  })
  try {
    await downloadInChunks(baseUrl, fileStream, null) // null = no abort during /tmp download
    fileStream.end()
    await closePromise
  } catch (err) {
    fileStream.destroy()
    throw err
  }
}

// ── Merge with ffmpeg, pipe output to res ────────────────────────────────────
function mergeWithFfmpeg(videoFile, audioFile, res, req) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      '-y',
      '-i', videoFile,
      '-i', audioFile,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    ff.stdout.pipe(res, { end: false })
    ff.stderr.on('data', d => process.stderr.write(`[ffmpeg] ${d}`))
    req.on('close', () => { try { ff.kill('SIGTERM') } catch {} })
    ff.on('close', code => (code === 0 || code === null) ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))
    ff.on('error', reject)
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
    downloadType,    // 'video' | 'videoOnly' | 'audio'
    downloadQuality, // e.g. '1080p', '720p', 'best'
  } = req.query

  if (!videoUrl && !directUrl) return res.status(400).json({ error: 'videoUrl or directUrl required' })
  const safeFilename = (filename || 'video.mp4').replace(/"/g, '')

  const abortController = new AbortController()
  req.on('close', () => abortController.abort())

  try {
    // ── YouTube ───────────────────────────────────────────────────────────────
    if (platform === 'youtube' && videoUrl) {
      const videoId = extractYouTubeId(videoUrl)
      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

      const { Innertube } = await initYoutubei()
      // Use normal customFetch for getInfo (we need the player data for deciphering)
      const yt = await Innertube.create({
        lang: 'en', location: 'US',
        retrieve_player: true,
        generate_session_locally: true,
        fetch: customFetch,
      })
      const info = await yt.getInfo(videoId, { client: 'MWEB' })
      console.log('[download] Video:', info.basic_info.title?.slice(0, 50), '| type:', downloadType, '| quality:', downloadQuality)

      const isAudio = downloadType === 'audio'
      const isHighQuality = downloadType === 'videoOnly' ||
        (['1080p', '1440p', '2160p', '240p', '144p'].includes(downloadQuality) && downloadType === 'video')

      // ── Audio-only download ─────────────────────────────────────────────────
      // Get deciphered audio CDN URL, then stream in safe 1MB chunks to browser.
      if (isAudio) {
        console.log('[download] Audio: capturing deciphered URL…')
        const audioBaseUrl = await getDecipheredUrl(info, {
          type: 'audio', quality: 'best', format: 'any', client: 'MWEB'
        })
        console.log('[download] ✅ Audio URL captured, streaming in 1MB chunks…')

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Cache-Control', 'no-store')

        await downloadInChunks(audioBaseUrl, res, abortController.signal)
        if (!res.writableEnded) res.end()
        return
      }

      // ── High-quality video (1080p / 1440p / 2160p / 144p / 240p) ──────────
      // Video-only adaptive + best audio → download both to /tmp → ffmpeg merge
      if (isHighQuality) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const videoTmp = join(tmpdir(), `ytv_${id}.mp4`)
        const audioTmp = join(tmpdir(), `yta_${id}.m4a`)

        try {
          console.log(`[download] HQ video: capturing video URL (${downloadQuality})…`)
          const videoBaseUrl = await getDecipheredUrl(info, {
            type: 'video', quality: downloadQuality, format: 'mp4', client: 'MWEB'
          })
          console.log(`[download] ✅ Video URL captured, downloading to /tmp…`)
          await downloadToFile(videoBaseUrl, videoTmp)  // no abort — browser hasn't received data yet
          console.log('[download] ✅ Video file written')

          console.log('[download] Capturing audio URL…')
          const audioBaseUrl = await getDecipheredUrl(info, {
            type: 'audio', quality: 'best', format: 'any', client: 'MWEB'
          })
          console.log('[download] ✅ Audio URL captured, downloading to /tmp…')
          await downloadToFile(audioBaseUrl, audioTmp)  // no abort
          console.log('[download] ✅ Audio file written')

          res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
          res.setHeader('Content-Type', 'video/mp4')
          res.setHeader('Cache-Control', 'no-store')

          console.log('[download] 🎬 Merging with ffmpeg…')
          await mergeWithFfmpeg(videoTmp, audioTmp, res, req)
          console.log('[download] ✅ Merge complete')
        } finally {
          unlink(videoTmp, () => {})
          unlink(audioTmp, () => {})
        }
        if (!res.writableEnded) res.end()
        return
      }

      // ── Combined muxed stream (360p, 480p, 720p) ──────────────────────────
      // These already have audio. Stream directly using youtubei.js's single-fetch path.
      console.log('[download] Combined stream (single-fetch)…')
      const combinedStream = await info.download({
        type: 'video+audio',
        quality: 'best',
        format: 'any',
        client: 'MWEB',
      })
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

    // ── Other platforms — proxy CDN URL directly ──────────────────────────────
    const targetUrl = directUrl || videoUrl
    if (!targetUrl) return res.status(400).json({ error: 'No download URL provided' })

    const upstream = await globalThis.fetch(targetUrl, {
      headers: {
        'User-Agent': webUA, 'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
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
