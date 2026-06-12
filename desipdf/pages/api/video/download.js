import vm from 'node:vm'

export const config = {
  maxDuration: 300,
  api: { responseLimit: false },
}

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
    console.log('[googlevideo fetch] Intercepted in download customFetch:', JSON.stringify(init.headers, null, 2))
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const {
    videoUrl,
    platform,
    filename = 'video.mp4',
    directUrl,
    downloadType,     // 'video' | 'videoOnly' | 'audio' | 'direct'
    downloadQuality,  // e.g. '720p', '360p', 'best'
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
      // 'videoOnly' = adaptive video-only stream (1080p+, 144p, 240p etc.)
      // 'video'     = combined video+audio stream (360p, 480p, 720p typically)
      const isVideoOnly = downloadType === 'videoOnly'
      const contentType = isAudio ? 'audio/mpeg' : 'video/mp4'

      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'no-store')

      // Map quality label → youtubei quality string
      const qualityMap = {
        '2160p': '2160p', '1440p': '1440p', '1080p': '1080p',
        '720p': '720p', '480p': '480p', '360p': '360p',
        '240p': '240p', '144p': '144p', 'best': 'best',
      }

      // CRITICAL: adaptive streams must use type:'video', combined streams use type:'video+audio'
      let dlType
      if (isAudio) {
        dlType = 'audio'
      } else if (isVideoOnly) {
        dlType = 'video'      // adaptive video-only (no audio track)
      } else {
        dlType = 'video+audio' // combined muxed stream
      }

      const downloadOpts = {
        type: dlType,
        quality: qualityMap[downloadQuality] || 'best',
        format: 'any',
        client: 'MWEB',
      }

      // youtubei.js download() returns a web ReadableStream — pipe it out
      const dlStream = await info.download(downloadOpts)
      const reader = dlStream.getReader()

      req.on('close', () => {
        try { reader.cancel() } catch {}
      })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!res.writable) break
        const flushed = res.write(Buffer.from(value))
        if (!flushed) {
          await new Promise(resolve => res.once('drain', resolve))
        }
      }

      if (!res.writableEnded) res.end()
      return
    }

    // ── Other platforms — proxy direct CDN URL ────────────────────────────────
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

    const contentType = upstream.headers.get('content-type') || 'video/mp4'
    const contentLength = upstream.headers.get('content-length')

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
    res.setHeader('Cache-Control', 'no-store')
    if (contentLength) res.setHeader('Content-Length', contentLength)

    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!res.writable) break
      const flushed = res.write(value)
      if (!flushed) {
        await new Promise(resolve => res.once('drain', resolve))
      }
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
