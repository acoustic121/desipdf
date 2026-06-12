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

// ── Custom fetch: replaces ALL headers for googlevideo CDN with minimal safe set ──
// YouTube CDN returns 403 when 'referer' or 'origin' is set from a server IP.
// Stripping to just User-Agent + Accept consistently yields 200.
function customFetch(input, init) {
  let url = ''
  if (typeof input === 'string') url = input
  else if (input instanceof URL) url = input.toString()
  else if (input?.url) url = typeof input.url === 'string' ? input.url : String(input.url)
  else if (typeof input?.toString === 'function') url = input.toString()

  if (url && url.includes('googlevideo.com')) {
    // Replace ALL headers — do NOT keep referer, origin, DNT, etc.
    init = {
      ...(init || {}),
      headers: {
        'User-Agent': webUA,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }
  }
  return globalThis.fetch(input, init)
}

// ── Lazy-load youtubei.js (cached per cold-start) ─────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// Write web ReadableStream to a temp file
async function webStreamToFile(webStream, filePath) {
  const reader = webStream.getReader()
  const fileStream = createWriteStream(filePath)
  return new Promise(async (resolve, reject) => {
    fileStream.on('error', reject)
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const ok = fileStream.write(Buffer.from(value))
        if (!ok) await new Promise(r => fileStream.once('drain', r))
      }
      fileStream.end()
      fileStream.once('finish', resolve)
    } catch (err) {
      fileStream.destroy()
      try { reader.cancel() } catch {}
      reject(err)
    }
  })
}

// Run ffmpeg and pipe stdout to res
function spawnFfmpeg(args, res, req) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
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
    downloadQuality, // e.g. '360p', 'best'
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

      const isAudio = downloadType === 'audio'

      // ── Audio: download combined → extract audio with ffmpeg ───────────────
      // YouTube CDN blocks server-side adaptive audio stream downloads (403).
      // Workaround: download the combined (muxed) stream which works fine,
      // then extract the audio track with ffmpeg.
      if (isAudio) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const combinedTmp = join(tmpdir(), `ytc_${id}.mp4`)

        try {
          console.log('[download] Audio: downloading combined stream for audio extraction…')
          const combinedStream = await info.download({
            type: 'video+audio',
            quality: 'best',
            format: 'any',
            client: 'MWEB',
          })
          await webStreamToFile(combinedStream, combinedTmp)
          console.log('[download] ✅ Combined stream saved to /tmp')

          res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Cache-Control', 'no-store')

          console.log('[download] 🎵 Extracting audio with ffmpeg…')
          await spawnFfmpeg([
            '-y', '-i', combinedTmp,
            '-vn',              // strip video
            '-c:a', 'libmp3lame',
            '-b:a', '192k',
            '-f', 'mp3',
            'pipe:1',
          ], res, req)
          console.log('[download] ✅ Audio extraction complete')
        } finally {
          unlink(combinedTmp, () => {})
        }
        if (!res.writableEnded) res.end()
        return
      }

      // ── Video (combined or adaptive): always use combined muxed stream ─────
      // Adaptive video-only streams (1080p+) are CDN-blocked from server IPs.
      // We download the best available combined stream (typically 360p–720p).
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Cache-Control', 'no-store')

      const videoStream = await info.download({
        type: 'video+audio',
        quality: 'best',   // best available combined
        format: 'any',
        client: 'MWEB',
      })
      const reader = videoStream.getReader()
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

    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': webUA,
        'Accept': '*/*',
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
