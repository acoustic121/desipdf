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

// ── Custom fetch: strips Origin & sets UA for googlevideo CDN requests ─────────

function customFetch(input, init) {
  let url = ''
  if (typeof input === 'string') url = input
  else if (input instanceof URL) url = input.toString()
  else if (input?.url) url = typeof input.url === 'string' ? input.url : input.url.toString()
  else if (typeof input?.toString === 'function') url = input.toString()

  if (url && url.includes('googlevideo.com')) {
    init = init || {}
    let headers = init.headers || {}

    if (typeof headers.delete === 'function') {
      headers.delete('origin')
      headers.delete('Origin')
      headers.set('User-Agent', webUA)
    } else if (Array.isArray(headers)) {
      init.headers = headers.filter(h => h[0].toLowerCase() !== 'origin')
      const uaIdx = init.headers.findIndex(h => h[0].toLowerCase() === 'user-agent')
      if (uaIdx > -1) init.headers[uaIdx] = ['User-Agent', webUA]
      else init.headers.push(['User-Agent', webUA])
    } else {
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'origin' || k.toLowerCase() === 'user-agent') delete headers[k]
      }
      headers['User-Agent'] = webUA
    }
    init.headers = headers
  }
  return globalThis.fetch(input, init)
}

// ── Lazy-load youtubei.js (cached per process) ────────────────────────────────

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

const qualityMap = {
  '2160p': '2160p', '1440p': '1440p', '1080p': '1080p',
  '720p': '720p', '480p': '480p', '360p': '360p',
  '240p': '240p', '144p': '144p', 'best': 'best',
}

// Write a web ReadableStream to a temp file, returns the file path
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

// Merge videoFile + audioFile with ffmpeg, pipe output to res
function mergeWithFfmpeg(videoFile, audioFile, res, req) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', videoFile,
      '-i', audioFile,
      '-c:v', 'copy',     // no re-encode — very fast
      '-c:a', 'aac',      // re-encode audio to AAC (compatible with MP4)
      '-b:a', '192k',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ]

    const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    ff.stdout.pipe(res, { end: false })
    ff.stderr.on('data', d => process.stderr.write(`[ffmpeg] ${d}`))

    // Kill ffmpeg if client disconnects early
    req.on('close', () => { try { ff.kill('SIGTERM') } catch {} })

    ff.on('close', code => {
      if (code === 0 || code === null) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })
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
    downloadType,    // 'video' | 'videoOnly' | 'audio' | 'direct'
    downloadQuality, // e.g. '720p', '1080p', 'best'
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
        lang: 'en',
        location: 'US',
        retrieve_player: true,
        generate_session_locally: true,
        fetch: customFetch,
      })

      const info = await yt.getInfo(videoId, { client: 'MWEB' })

      const isAudio = downloadType === 'audio'
      const isVideoOnly = downloadType === 'videoOnly'  // adaptive, no embedded audio

      // ── Audio-only download ─────────────────────────────────────────────────
      if (isAudio) {
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Cache-Control', 'no-store')

        const stream = await info.download({
          type: 'audio',
          quality: 'best',
          format: 'any',
          client: 'MWEB',
        })
        const reader = stream.getReader()
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

      // ── Combined (muxed) stream — 360p / 480p / 720p ───────────────────────
      if (!isVideoOnly) {
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
        res.setHeader('Content-Type', 'video/mp4')
        res.setHeader('Cache-Control', 'no-store')

        const stream = await info.download({
          type: 'video+audio',
          quality: qualityMap[downloadQuality] || 'best',
          format: 'any',
          client: 'MWEB',
        })
        const reader = stream.getReader()
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

      // ── Adaptive video-only (1080p, 1440p, 2160p, 144p, 240p) ─────────────
      // These streams have no audio — we must:
      //   1. Download video-only stream → tmp
      //   2. Download best audio stream → tmp
      //   3. Merge with ffmpeg (copy video, encode audio to AAC)
      //   4. Stream merged MP4 to browser

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const videoTmp = join(tmpdir(), `ytv_${id}.mp4`)
      const audioTmp = join(tmpdir(), `yta_${id}.m4a`)

      try {
        console.log(`[download] Fetching video stream (${downloadQuality})…`)
        const videoStream = await info.download({
          type: 'video',
          quality: qualityMap[downloadQuality] || 'best',
          format: 'any',
          client: 'MWEB',
        })
        await webStreamToFile(videoStream, videoTmp)
        console.log('[download] ✅ Video stream saved to /tmp')

        console.log('[download] Fetching audio stream…')
        const audioStream = await info.download({
          type: 'audio',
          quality: 'best',
          format: 'any',
          client: 'MWEB',
        })
        await webStreamToFile(audioStream, audioTmp)
        console.log('[download] ✅ Audio stream saved to /tmp')

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
        res.setHeader('Content-Type', 'video/mp4')
        res.setHeader('Cache-Control', 'no-store')

        console.log('[download] 🎬 Merging video + audio with ffmpeg…')
        await mergeWithFfmpeg(videoTmp, audioTmp, res, req)
        console.log('[download] ✅ Merge complete')

      } finally {
        unlink(videoTmp, () => {})
        unlink(audioTmp, () => {})
      }

      if (!res.writableEnded) res.end()
      return
    }

    // ── Other platforms — proxy CDN URL directly ──────────────────────────────
    const targetUrl = directUrl || videoUrl
    if (!targetUrl) return res.status(400).json({ error: 'No download URL provided' })

    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    })

    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream CDN returned ${upstream.status}` })
    }

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
