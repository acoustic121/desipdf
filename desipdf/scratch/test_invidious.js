const videoId = 'aqz-KE-bpKQ'

// Default fallback instances:
let instances = [
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://inv.in.projectsegfau.lt',
  'https://invidious.asir.dev',
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.privacydev.net',
]

async function run() {
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
          .slice(0, 5)
        if (dynamicInstances.length > 0) {
          instances = [...new Set([...dynamicInstances, ...instances])]
        }
      }
    }
  } catch (e) {
    console.warn('[Invidious] Failed to fetch dynamic instances list:', e.message)
  }

  console.log('Instances list to try:', instances)

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

      const title = data.title || 'YouTube Video'
      const thumb = data.videoThumbnails?.find(t => t.quality === 'maxres')?.url
        || data.videoThumbnails?.[0]?.url || ''

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
              filename: title,
            })
          }
          return acc
        }, [])

      if (!videoFormats.length) { console.warn(`[Invidious] ${instance} returned no video formats`); continue }

      console.log(`[Invidious] Success via ${instance}:`, JSON.stringify(videoFormats, null, 2))
      return
    } catch (e) {
      console.warn(`[Invidious] ${instance} failed:`, e.message.slice(0, 80))
    }
  }
  console.log('All Invidious instances failed.')
}

run().catch(console.error)
