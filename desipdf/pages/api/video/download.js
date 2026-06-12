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

// ── Extract URL string from fetch input ───────────────────────────────────────
function extractUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input?.url) return typeof input.url === 'string' ? input.url : String(input.url)
  if (typeof input?.toString === 'function') return input.toString()
  return ''
}

// ── Normal customFetch: strips all headers for googlevideo CDN ─────────────────
// YouTube CDN returns 403 when 'referer' or 'origin' is set from a server IP.
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

// ── Extract YouTube video ID ──────────────────────────────────────────────────
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
// YouTubei.js deciphers them internally when download() is called, but then uses
// 10MB chunks which trigger 403. We intercept the call, capture the deciphered
// URL, and do our own small-chunk download instead.
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
    return globalThis.fetch(input, init)
  }

  const yt = await Innertube.create({
    lang: 'en', location: 'US',
    retrieve_player: true,
    generate_session_locally: true,
    fetch: captureFetch,
  })
  const captureInfo = await yt.getInfo(info.basic_info.id, { client: 'MWEB' })
  try { await captureInfo.download(downloadOpts) } catch {}

  if (!captured) throw new Error('Could not decipher CDN URL for the requested format')
  return captured.replace(/&range=\d+-\d+/, '') // strip range — we'll add our own
}

// ── URL-refreshing chunk downloader ──────────────────────────────────────────
//
// YouTube CDN enforces a per-signed-URL byte quota (~28 MB / ~1 min of 4K video).
// After that limit the CDN returns 403, even though the URL isn't expired.
//
// Fix: call getUrl() every 24 MB to get a fresh signed URL and continue from the
// same byte offset. The new signature allows serving any range of the content.
//
// `getUrl`   — async () => baseUrl string (no &range param)
// `writable` — Node.js Writable (file stream or HTTP response)
// `knownSize` — total bytes expected (from clen URL param), or 0 if unknown
async function downloadWithRefresh(getUrl, writable, knownSize = 0) {
  const URL_QUOTA_BYTES = 24 * 1024 * 1024 // refresh every 24 MB (before ~28 MB CDN limit)
  const CHUNK = 1024 * 1024                // 1 MB per request (CDN blocks ≥ ~5 MB)
  const HDR = { 'User-Agent': webUA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' }

  let offset = 0
  let urlBytesUsed = 0
  let currentUrl = await getUrl()

  while (true) {
    // ── Proactive URL refresh before hitting the CDN byte quota ──────────────
    if (urlBytesUsed >= URL_QUOTA_BYTES) {
      console.log(`[dl] URL refresh at ${(offset / 1e6).toFixed(1)} MB…`)
      currentUrl = await getUrl()
      urlBytesUsed = 0
    }

    if (knownSize > 0 && offset >= knownSize) break

    const end = offset + CHUNK - 1
    let chunkUrl = `${currentUrl}&range=${offset}-${end}`

    // ── Fetch with one URL-refresh retry on 403 ──────────────────────────────
    let resp = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await globalThis.fetch(chunkUrl, { headers: HDR })
        if (resp.ok) break

        if (resp.status === 403) {
          if (offset === 0) throw new Error('CDN 403 on first chunk — URL invalid')
          if (attempt === 0) {
            // Quota hit: get a fresh URL and retry this same chunk
            console.log(`[dl] 403 at ${(offset / 1e6).toFixed(1)} MB → refreshing URL`)
            currentUrl = await getUrl()
            urlBytesUsed = 0
            chunkUrl = `${currentUrl}&range=${offset}-${end}`
            continue
          }
          // Still 403 after refresh = genuine end or hard block
          console.log(`[dl] 403 after refresh at ${(offset / 1e6).toFixed(1)} MB — stopping`)
          resp = null
        }
        break
      } catch (err) {
        if (attempt === 1) throw err
        await new Promise(r => setTimeout(r, 400))
      }
    }

    if (!resp || !resp.ok) {
      if (offset === 0) throw new Error('CDN rejected first chunk')
      break
    }

    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length === 0) break

    const ok = writable.write(buf)
    if (!ok) await new Promise(r => writable.once('drain', r))

    offset += buf.length
    urlBytesUsed += buf.length
    if (buf.length < CHUNK) break // last chunk
  }

  console.log(`[dl] ✅ ${(offset / 1e6).toFixed(1)} MB / ${knownSize > 0 ? (knownSize / 1e6).toFixed(1) + ' MB' : '?'}`)
}

// ── Download stream to a /tmp file ────────────────────────────────────────────
// No abort signal — browser hasn't received any data yet so req.close fires
// prematurely on long downloads.
async function downloadToFile(getUrl, filePath, knownSize = 0) {
  const fileStream = createWriteStream(filePath)
  const closePromise = new Promise((resolve, reject) => {
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })
  try {
    await downloadWithRefresh(getUrl, fileStream, knownSize)
    fileStream.end()
    await closePromise
  } catch (err) {
    fileStream.destroy()
    throw err
  }
}

// ── Merge video + audio with ffmpeg, stream result to browser ─────────────────
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
    downloadQuality, // e.g. '2160p', '1080p', '720p', 'best'
  } = req.query

  if (!videoUrl && !directUrl) return res.status(400).json({ error: 'videoUrl or directUrl required' })
  const safeFilename = (filename || 'video.mp4').replace(/"/g, '')

  try {
    // ── YouTube ───────────────────────────────────────────────────────────────
    if (platform === 'youtube' && videoUrl) {
      const videoId = extractYouTubeId(videoUrl)
      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

      const { Innertube } = await initYoutubei()
      const yt = await Innertube.create({
        lang: 'en', location: 'US',
        retrieve_player: true,
        generate_session_locally: true,
        fetch: customFetch,
      })
      const info = await yt.getInfo(videoId, { client: 'MWEB' })
      console.log(`[download] "${info.basic_info.title?.slice(0, 50)}" | type:${downloadType} quality:${downloadQuality}`)

      const isAudio = downloadType === 'audio'
      const isHighQuality = downloadType === 'videoOnly' ||
        (['1080p', '1440p', '2160p', '240p', '144p'].includes(downloadQuality) && downloadType === 'video')

      // ── Audio-only ─────────────────────────────────────────────────────────
      if (isAudio) {
        const audioOpts = { type: 'audio', quality: 'best', format: 'any', client: 'MWEB' }
        console.log('[download] Audio: capturing URL…')
        const firstUrl = await getDecipheredUrl(info, audioOpts)
        const clen = parseInt(new URL(firstUrl).searchParams.get('clen') || '0', 10) || 0
        console.log(`[download] ✅ Audio URL ready, size: ${(clen / 1e6).toFixed(1)} MB`)

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Cache-Control', 'no-store')

        let firstUsed = false
        await downloadWithRefresh(
          () => { if (!firstUsed) { firstUsed = true; return firstUrl } return getDecipheredUrl(info, audioOpts) },
          res, clen
        )
        if (!res.writableEnded) res.end()
        return
      }

      // ── High-quality adaptive video (1080p / 1440p / 2160p / 144p / 240p) ──
      // Video-only stream + audio stream → /tmp → ffmpeg merge → browser
      if (isHighQuality) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const videoTmp = join(tmpdir(), `ytv_${id}.mp4`)
        const audioTmp = join(tmpdir(), `yta_${id}.m4a`)

        try {
          // ── Video ─────────────────────────────────────────────────────────
          const vOpts = { type: 'video', quality: downloadQuality, format: 'mp4', client: 'MWEB' }
          console.log(`[download] Capturing video URL (${downloadQuality})…`)
          const firstVideoUrl = await getDecipheredUrl(info, vOpts)
          const vClen = parseInt(new URL(firstVideoUrl).searchParams.get('clen') || '0', 10) || 0
          console.log(`[download] ✅ Video URL ready, size: ${(vClen / 1e6).toFixed(1)} MB`)

          let vFirst = false
          const getVideoUrl = () => {
            if (!vFirst) { vFirst = true; return firstVideoUrl }
            return getDecipheredUrl(info, vOpts)
          }
          console.log('[download] Downloading video to /tmp…')
          await downloadToFile(getVideoUrl, videoTmp, vClen)
          console.log('[download] ✅ Video written')

          // ── Audio ─────────────────────────────────────────────────────────
          const aOpts = { type: 'audio', quality: 'best', format: 'any', client: 'MWEB' }
          console.log('[download] Capturing audio URL…')
          const firstAudioUrl = await getDecipheredUrl(info, aOpts)
          const aClen = parseInt(new URL(firstAudioUrl).searchParams.get('clen') || '0', 10) || 0
          console.log(`[download] ✅ Audio URL ready, size: ${(aClen / 1e6).toFixed(1)} MB`)

          let aFirst = false
          const getAudioUrl = () => {
            if (!aFirst) { aFirst = true; return firstAudioUrl }
            return getDecipheredUrl(info, aOpts)
          }
          await downloadToFile(getAudioUrl, audioTmp, aClen)
          console.log('[download] ✅ Audio written')

          // ── Merge ─────────────────────────────────────────────────────────
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
      // Single-fetch path — no range chunking needed, works reliably.
      console.log('[download] Combined stream…')
      const combinedStream = await info.download({
        type: 'video+audio', quality: 'best', format: 'any', client: 'MWEB',
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
