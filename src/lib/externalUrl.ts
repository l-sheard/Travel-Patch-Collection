// Guards the one place user-entered text reaches an attribute the browser will
// act on: the href of an accommodation/restaurant link.
//
// `javascript:` in an href executes on click, and <input type="url"> does not
// help — a javascript: URL is a well-formed absolute URL, so it passes browser
// validation. Today RLS means you can only do this to yourself, but the moment
// a collection becomes shareable the same stored value is served to someone
// else, so it's filtered on the way out rather than on the way in.

const SAFE_PROTOCOLS = ['http:', 'https:']

/**
 * Returns a normalized absolute http(s) URL, or null if the input isn't one.
 *
 * Parsed with `URL` rather than matched as a string: the parser strips tabs and
 * newlines before reading the scheme, so `java\tscript:alert(1)` — which a
 * naive `startsWith('javascript:')` check misses but the browser still runs —
 * ends up as the `javascript:` it really is and gets rejected. Callers get back
 * `href` (the parsed form) so the value in the attribute is exactly what was
 * inspected, not the raw text.
 *
 * Anything else — a relative path, a bare `example.com`, a scheme like
 * `data:`/`file:`/`vbscript:` — returns null, and callers render plain text
 * instead. Nothing is rewritten to make it safe: an unsafe URL stops being a
 * link rather than becoming a different one.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : null
}
