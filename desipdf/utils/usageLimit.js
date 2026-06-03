// ─── CLIENT-SIDE USAGE TRACKING (localStorage) ────────────────────────────────
// Tracks daily conversions per browser. Resets at midnight automatically.

export const FREE_LIMIT_PER_DAY = 15
export const FREE_FILES_PER_MERGE = 10  // max files in a single merge/batch operation

const STORAGE_KEY = 'pdfchampion_usage'

function getTodayKey() {
  return new Date().toISOString().slice(0, 10) // "2026-06-03"
}

export function getUsageData() {
  if (typeof window === 'undefined') return { count: 0, date: getTodayKey() }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, date: getTodayKey() }
    const data = JSON.parse(raw)
    // Reset if it's a new day
    if (data.date !== getTodayKey()) return { count: 0, date: getTodayKey() }
    return data
  } catch {
    return { count: 0, date: getTodayKey() }
  }
}

export function incrementUsage() {
  if (typeof window === 'undefined') return
  const data = getUsageData()
  const updated = { ...data, count: data.count + 1, date: getTodayKey() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated.count
}

export function getRemainingUses() {
  const { count } = getUsageData()
  return Math.max(0, FREE_LIMIT_PER_DAY - count)
}

export function hasReachedLimit() {
  return getUsageData().count >= FREE_LIMIT_PER_DAY
}

export function resetUsage() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

// ─── SERVER-SIDE IP TRACKING helper ───────────────────────────────────────────
// Called by API middleware. Uses a simple in-process Map for the current
// Vercel function instance. Not 100% persistent across cold starts but adds a
// meaningful extra layer. For production, swap with Upstash Redis.

const ipStore = new Map() // { ip: { count, date } }

export function checkIpLimit(ip, limit = 15) {
  const today = new Date().toISOString().slice(0, 10)
  const entry = ipStore.get(ip)

  if (!entry || entry.date !== today) {
    ipStore.set(ip, { count: 1, date: today })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count += 1
  return { allowed: true, remaining: limit - entry.count }
}

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}
