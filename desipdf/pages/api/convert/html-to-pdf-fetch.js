function isPrivateHost(hostname) {
  const host = hostname.toLowerCase()
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) return true
  if (host.endsWith('.local')) return true

  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!ipv4) return false

  const [, aRaw, bRaw] = ipv4
  const a = Number(aRaw)
  const b = Number(bRaw)
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
  maxDuration: 30,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rawUrl = String(req.body?.url || '').trim()
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return res.status(400).json({ error: 'Enter a valid http or https URL' })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http and https URLs are supported' })
  }
  if (isPrivateHost(parsed.hostname)) {
    return res.status(400).json({ error: 'Private or local network URLs are not supported' })
  }

  try {
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'PDFChampion HTML to PDF Bot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      return res.status(502).json({ error: `The webpage returned ${response.status}` })
    }
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(400).json({ error: 'That URL did not return HTML content' })
    }

    const html = await response.text()
    if (html.length > 2_000_000) {
      return res.status(413).json({ error: 'This webpage is too large to convert. Try pasting a smaller HTML document.' })
    }

    res.status(200).json({ html, finalUrl: response.url || parsed.toString() })
  } catch {
    res.status(502).json({ error: 'Could not fetch that webpage. It may block automated requests.' })
  }
}
