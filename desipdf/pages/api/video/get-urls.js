/**
 * /api/video/get-urls
 *
 * Deciphers YouTube adaptive stream URLs and returns them as JSON.
 * The BROWSER then fetches directly from YouTube CDN (no server IP rate limit),
 * downloads video + audio in chunks, and merges them using ffmpeg.wasm.
 */

import vm from 'node:vm'

const webUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { videoUrl, downloadType, downloadQuality } = req.query
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl required' })

  const videoId = extractYouTubeId(videoUrl)
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' })

  try {
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

    const vOpts = { type: 'video', quality: downloadQuality, format: 'mp4', client: 'MWEB' }
    const aOpts = { type: 'audio', quality: 'best', format: 'any', client: 'MWEB' }

    const [videoStreamUrl, audioStreamUrl] = await Promise.all([
      getDecipheredUrl(info, vOpts),
      getDecipheredUrl(info, aOpts),
    ])

    const vClen = parseInt(new URL(videoStreamUrl).searchParams.get('clen') || '0', 10) || 0
    const aClen = parseInt(new URL(audioStreamUrl).searchParams.get('clen') || '0', 10) || 0

    console.log(`[get-urls] ${info.basic_info.title?.slice(0, 40)} | video: ${(vClen / 1e6).toFixed(1)}MB | audio: ${(aClen / 1e6).toFixed(1)}MB`)

    // Set CORS headers so the browser can use these URLs directly
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({
      videoStreamUrl,
      audioStreamUrl,
      videoSize: vClen,
      audioSize: aClen,
      title: info.basic_info.title || 'YouTube Video',
    })
  } catch (err) {
    console.error('[get-urls]', err.message)
    res.status(500).json({ error: err.message })
  }
}
