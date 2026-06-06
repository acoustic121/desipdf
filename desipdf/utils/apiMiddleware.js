/**
 * withRateLimit — legacy wrapper kept so existing API handlers do not need to
 * change. The site currently allows unlimited conversions for every visitor.
 * Premium/Supabase integrations remain available for future use.
 */
export function withRateLimit(handler) {
  return async function (req, res) {
    return handler(req, res)
  }
}
