import { checkIpLimit, getClientIp } from './usageLimit'

/**
 * withRateLimit — wraps an API handler with IP-based rate limiting.
 * Premium users bypass the limit entirely (verified via Supabase + JWT token).
 */
export function withRateLimit(handler) {
  return async function (req, res) {
    if (req.method !== 'POST') return handler(req, res)

    // Check premium status via Authorization header (JWT from Supabase)
    let isPremium = false
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { createClient } = require('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user?.id) {
          const { data } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .single()
          isPremium = !!data
        }
      }
    } catch {
      // If Supabase isn't configured, fall through to IP check
    }

    if (isPremium) {
      res.setHeader('X-Premium', 'true')
      return handler(req, res)
    }

    // Free users: check IP rate limit
    const ip = getClientIp(req)
    const { allowed, remaining } = checkIpLimit(ip)
    res.setHeader('X-RateLimit-Limit', 15)
    res.setHeader('X-RateLimit-Remaining', remaining)

    if (!allowed) {
      return res.status(429).json({
        error: 'Daily free limit reached. Upgrade to DesiPDF Premium for unlimited access.',
        remaining: 0,
        upgradeUrl: '/pricing',
      })
    }

    return handler(req, res)
  }
}
