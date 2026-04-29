// Sliding-window in-memory rate limiter
// Works per serverless instance — sufficient for brute-force / abuse protection on Vercel

const store = new Map<string, number[]>()

interface RateLimitOptions {
  windowMs?: number
  max?: number
}

export function checkRateLimit(
  ip: string,
  { windowMs = 60_000, max = 30 }: RateLimitOptions = {}
): { limited: boolean; remaining: number; retryAfter: number } {
  const now = Date.now()
  const timestamps = (store.get(ip) ?? []).filter(t => now - t < windowMs)
  timestamps.push(now)
  store.set(ip, timestamps)

  if (timestamps.length > max) {
    const oldest = timestamps[0]
    return { limited: true, remaining: 0, retryAfter: Math.ceil((oldest + windowMs - now) / 1000) }
  }
  return { limited: false, remaining: max - timestamps.length, retryAfter: 0 }
}

// Cleanup entries older than 10 minutes to avoid memory leak
setInterval(() => {
  const cutoff = Date.now() - 600_000
  Array.from(store.entries()).forEach(([key, timestamps]) => {
    const fresh = timestamps.filter((t: number) => t > cutoff)
    if (fresh.length === 0) store.delete(key)
    else store.set(key, fresh)
  })
}, 300_000)

export function getClientIP(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
  const realIP = req.headers['x-real-ip']
  if (realIP) return Array.isArray(realIP) ? realIP[0] : realIP
  return req.socket?.remoteAddress ?? 'unknown'
}
