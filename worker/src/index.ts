export interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ALLOWED_ORIGINS: string
  /** Cloudflare edge rate limiter — configured in wrangler.jsonc. */
  BG_REMOVAL_LIMIT: RateLimit
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

// Returns the caller's Supabase user id, or null if the token isn't valid.
// The id (rather than just a yes/no) is what lets the rate limit below be
// per-account: keying on IP would lump everyone behind a carrier NAT together
// and still let one person rotate addresses.
async function authenticateUser(authHeader: string | null, env: Env): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
  })
  if (!res.ok) return null
  const user = await res.json<{ id?: string }>()
  return user.id ?? null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors })
    }

    const userId = await authenticateUser(request.headers.get('Authorization'), env)
    if (!userId) {
      return new Response('Unauthorized', { status: 401, headers: cors })
    }

    // Rate limited per account, and only after authenticating: the quota worth
    // protecting is Cloudflare Images, which nothing below can reach without a
    // valid session, and checking afterwards means an unauthenticated flood
    // can't burn a real user's allowance by guessing their id.
    const { success } = await env.BG_REMOVAL_LIMIT.limit({ key: userId })
    if (!success) {
      return new Response('Too many background removal requests. Try again in a minute.', {
        status: 429,
        headers: { ...cors, 'Retry-After': '60' },
      })
    }

    let imageUrl: string | undefined
    try {
      const body = await request.json<{ imageUrl?: string }>()
      imageUrl = body.imageUrl
    } catch {
      return new Response('Invalid JSON body', { status: 400, headers: cors })
    }

    // Only allow processing images from this project's own Supabase Storage —
    // not an open proxy for arbitrary URLs (protects the free Images/Workers
    // AI quota from being used for anything unrelated to this app).
    if (!imageUrl || !imageUrl.startsWith(`${env.SUPABASE_URL}/storage/`)) {
      return new Response('imageUrl must be a signed URL from this project\'s Supabase Storage', {
        status: 400,
        headers: cors,
      })
    }

    const segmented = await fetch(imageUrl, {
      cf: {
        image: {
          segment: 'foreground',
          format: 'png',
        },
      },
    } as RequestInit)

    if (!segmented.ok) {
      return new Response('Background removal failed', { status: 502, headers: cors })
    }

    return new Response(segmented.body, {
      headers: { ...cors, 'Content-Type': 'image/png' },
    })
  },
}
