// Guards the security headers in netlify.toml.
//
// A CSP fails silently: the page loads, one feature stops working, and the only
// evidence is a console violation nobody is watching for. Every origin asserted
// here is load-bearing, with the feature that needs it named, so pruning one
// fails here instead of in production.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Resolved from the working directory rather than import.meta.url: under the
// jsdom environment import.meta.url is an http:// URL, which readFileSync
// rejects.
const toml = readFileSync(join(process.cwd(), 'netlify.toml'), 'utf8')

function headerValue(name: string): string {
  const match = toml.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm'))
  if (!match) throw new Error(`netlify.toml has no ${name} header`)
  return match[1]
}

const csp = headerValue('Content-Security-Policy')

/** The source expressions for one CSP directive. */
function directive(name: string): string[] {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
  if (found === undefined) throw new Error(`CSP has no ${name} directive`)
  return found.split(/\s+/).slice(1)
}

describe('response headers', () => {
  it('blocks MIME sniffing', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff')
  })

  // Patch ids live in the URL path, so the full URL must not go to
  // OpenStreetMap or Google Fonts in a Referer header.
  it('does not leak the path cross-origin in the referrer', () => {
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('refuses to be framed, for CSP and non-CSP browsers alike', () => {
    expect(headerValue('X-Frame-Options')).toBe('DENY')
    expect(directive('frame-ancestors')).toEqual(["'none'"])
  })

  it('sets HSTS', () => {
    expect(headerValue('Strict-Transport-Security')).toMatch(/max-age=\d+/)
  })
})

describe('CSP lockdown', () => {
  it('denies everything not explicitly allowed', () => {
    expect(directive('default-src')).toEqual(["'self'"])
  })

  // The audit finding behind all this was an injected href. These three are
  // what stop an injection escalating if one ever lands again.
  it('allows no script origin beyond self and Turnstile', () => {
    expect(directive('script-src')).toEqual(["'self'", 'https://challenges.cloudflare.com'])
  })

  it.each(["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "'strict-dynamic'", '*'])(
    'keeps %s out of script-src',
    (token) => {
      expect(directive('script-src')).not.toContain(token)
    },
  )

  it('pins down the other injection vectors', () => {
    expect(directive('object-src')).toEqual(["'none'"])
    expect(directive('base-uri')).toEqual(["'none'"])
    expect(directive('form-action')).toEqual(["'self'"])
  })

  it('uses no wildcard host anywhere except the OSM tile subdomains', () => {
    const wildcards = csp.match(/https:\/\/\*[^\s;]*/g) ?? []
    expect(wildcards).toEqual(['https://*.tile.openstreetmap.org'])
  })
})

describe('CSP still permits what the app actually does', () => {
  // Each entry: the origin, and what breaks without it.
  const connectOrigins: [string, string][] = [
    ['https://ilymsmgssrkrnrkobayu.supabase.co', 'Supabase REST, auth, storage and the delete-account function'],
    ['https://travel-patches-bg-removal.lara-sheard9.workers.dev', 'the background-removal Worker'],
    ['https://nominatim.openstreetmap.org', 'location search in src/lib/geocode.ts'],
    // MobileNet is fetched from tfhub.dev, which 302s to Kaggle and then to GCS.
    // CSP is enforced on every hop, so dropping any one breaks scan-to-match.
    ['https://tfhub.dev', 'the MobileNet download (first hop)'],
    ['https://www.kaggle.com', 'the MobileNet download (second hop, redirect target)'],
    ['https://storage.googleapis.com', 'the MobileNet weights (final hop, redirect target)'],
  ]

  it.each(connectOrigins)('connect-src allows %s — needed for %s', (origin) => {
    expect(directive('connect-src')).toContain(origin)
  })

  it('connect-src allows self, for the service worker and precached assets', () => {
    expect(directive('connect-src')).toContain("'self'")
  })

  it('img-src allows the buckets photos are served from', () => {
    expect(directive('img-src')).toContain('https://ilymsmgssrkrnrkobayu.supabase.co')
  })

  it('img-src allows the map tile subdomains', () => {
    expect(directive('img-src')).toContain('https://*.tile.openstreetmap.org')
  })

  // Leaflet inlines its marker icons as data: URIs in its own stylesheet, and
  // photo previews are blob: URLs from URL.createObjectURL.
  it('img-src allows data: and blob:', () => {
    expect(directive('img-src')).toContain('data:')
    expect(directive('img-src')).toContain('blob:')
  })

  it('allows the Google Fonts stylesheet and its font files', () => {
    expect(directive('style-src')).toContain('https://fonts.googleapis.com')
    expect(directive('font-src')).toContain('https://fonts.gstatic.com')
  })

  // Turnstile renders its challenge in an iframe.
  it('allows the Turnstile iframe', () => {
    expect(directive('frame-src')).toContain('https://challenges.cloudflare.com')
  })

  it('allows the service worker and the PWA manifest', () => {
    expect(directive('worker-src')).toEqual(["'self'"])
    expect(directive('manifest-src')).toEqual(["'self'"])
  })
})
