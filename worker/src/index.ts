export interface Env {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ALLOWED_ORIGINS: string
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

async function verifySupabaseUser(authHeader: string | null, env: Env): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
  })
  return res.ok
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

    const authed = await verifySupabaseUser(request.headers.get('Authorization'), env)
    if (!authed) {
      return new Response('Unauthorized', { status: 401, headers: cors })
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
