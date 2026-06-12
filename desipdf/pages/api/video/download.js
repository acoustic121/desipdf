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
import { createWriteStream, createReadStream, unlink, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export const config = {
  maxDuration: 300,
  api: { responseLimit: false },
}

const webUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'

// ── Find yt-dlp binary ────────────────────────────────────────────────────────
function findYtDlp() {
  const candidates = [
    '/opt/homebrew/bin/yt-dlp',   // macOS Apple Silicon (brew)
    '/usr/local/bin/yt-dlp',      // macOS Intel (brew)
    '/usr/bin/yt-dlp',            // Linux
    '/usr/local/bin/yt-dlp',      // Linux pip
    join(process.env.HOME || '', '.local/bin/yt-dlp'),  // pip --user
    join(process.env.HOME || '', 'Library/Python/3.14/bin/yt-dlp'),
    join(process.env.HOME || '', 'Library/Python/3.13/bin/yt-dlp'),
    join(process.env.HOME || '', 'Library/Python/3.12/bin/yt-dlp'),
    join(process.env.HOME || '', 'Library/Python/3.11/bin/yt-dlp'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // Try PATH lookup
  try { const r = execFileSync('which', ['yt-dlp'], { encoding: 'utf8' }).trim(); if (r) return r } catch {}
  return null
}

const YT_DLP_PATH = findYtDlp()

// ── Download video+audio with yt-dlp, write merged MP4 to /tmp ───────────────
function ytDlpVideo(videoId, quality, outputPath) {
  return new Promise((resolve, reject) => {
    const height = parseInt(quality?.replace('p', '') || '1080', 10)
    const formatSel = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`
    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '--format', formatSel,
      '--output', outputPath,
      '--merge-output-format', 'mp4',
      '--no-playlist', '--no-warnings',
      '--ffmpeg-location', dirname(ffmpegPath),
      '--progress', '--newline',
    ]
    console.log(`[yt-dlp] Video: ${quality}`)
    const proc = spawn(YT_DLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stderrLines = []
    proc.stdout.on('data', d => process.stdout.write(`[yt-dlp] ${d}`))
    proc.stderr.on('data', d => { process.stderr.write(`[yt-dlp] ${d}`); stderrLines.push(String(d)) })
    proc.on('close', code => {
      if (code === 0) { console.log(`[yt-dlp] ✅ Video done → ${outputPath}`); resolve() }
      else reject(new Error(`yt-dlp video failed: ${stderrLines.join('').slice(-400) || `exit ${code}`}`))
    })
    proc.on('error', reject)
  })
}

// ── Download audio with yt-dlp, extract to MP3 ───────────────────────────────
function ytDlpAudio(videoId, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '--format', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '192K',
      '--output', outputPath,
      '--no-playlist', '--no-warnings',
      '--ffmpeg-location', dirname(ffmpegPath),
      '--progress', '--newline',
    ]
    console.log(`[yt-dlp] Audio: extracting MP3…`)
    const proc = spawn(YT_DLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stderrLines = []
    proc.stdout.on('data', d => process.stdout.write(`[yt-dlp] ${d}`))
    proc.stderr.on('data', d => { process.stderr.write(`[yt-dlp] ${d}`); stderrLines.push(String(d)) })
    proc.on('close', code => {
      if (code === 0) { console.log(`[yt-dlp] ✅ Audio done → ${outputPath}`); resolve() }
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
  return globalThis.fetch(input, init)
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
    return globalThis.fetch(input, init)
  }
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true, generate_session_locally: true, fetch: captureFetch })
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
        resp = await globalThis.fetch(chunkUrl, { headers: HDR })
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
function mergeWithFfmpeg(videoFile, audioFile, res, req) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
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
    // ── YouTube ───────────────────────────────────────────────────────────────
    if (platform === 'youtube' && videoUrl) {
      const videoId = extractYouTubeId(videoUrl)
      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

      const isAudio = downloadType === 'audio'
      const isHighQuality = downloadType === 'videoOnly' ||
        (['1080p', '1440p', '2160p', '240p', '144p'].includes(downloadQuality) && downloadType === 'video')

      // ── High-quality video: use yt-dlp if available ───────────────────────
      if (isHighQuality && YT_DLP_PATH) {
        console.log(`[download] Using yt-dlp for ${downloadQuality} (${YT_DLP_PATH})`)
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        // yt-dlp adds its own extension so use a base name
        const outBase = join(tmpdir(), `ytdl_${id}`)
        const outFile = `${outBase}.mp4`

        try {
          await ytDlpVideo(videoId, downloadQuality, outFile)

          if (!existsSync(outFile)) throw new Error('yt-dlp did not produce output file')

          res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
          res.setHeader('Content-Type', 'video/mp4')
          res.setHeader('Cache-Control', 'no-store')

          console.log('[download] Streaming yt-dlp output to browser…')
          await pipeFileToResponse(outFile, res, req)
          console.log('[download] ✅ Done')
        } finally {
          unlink(outFile, () => {})
        }
        if (!res.writableEnded) res.end()
        return
      }

      // ── Fallback: youtubei.js (works for ≤30 MB files / lower qualities) ──
      const { Innertube } = await initYoutubei()
      const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true, generate_session_locally: true, fetch: customFetch })
      const info = await yt.getInfo(videoId, { client: 'MWEB' })
      console.log(`[download] "${info.basic_info.title?.slice(0, 50)}" | type:${downloadType} q:${downloadQuality}`)

      // ── Audio: use yt-dlp if available (extract to proper MP3) ──────────────
      // The youtubei.js approach serves Opus/M4A as audio/mpeg which won't play,
      // and also hits the CDN rate limit (only ~1 MB per session for audio).
      if (isAudio && YT_DLP_PATH) {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const outFile = join(tmpdir(), `ytda_${id}.mp3`)
        try {
          await ytDlpAudio(videoId, outFile)
          if (!existsSync(outFile)) throw new Error('yt-dlp did not produce audio file')
          res.setHeader('Content-Disposition', `attachment; filename="${safeFilename.replace(/\.mp4$/, '.mp3')}"`)
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Cache-Control', 'no-store')
          await pipeFileToResponse(outFile, res, req)
        } finally {
          unlink(outFile, () => {})
        }
        if (!res.writableEnded) res.end()
        return
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
    const upstream = await globalThis.fetch(targetUrl, {
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
