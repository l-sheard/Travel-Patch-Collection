import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from './externalUrl'

describe('safeExternalUrl', () => {
  describe('allows real web links', () => {
    it('keeps an https URL', () => {
      expect(safeExternalUrl('https://example.com/hotel')).toBe('https://example.com/hotel')
    })

    it('keeps an http URL', () => {
      expect(safeExternalUrl('http://example.com/hotel')).toBe('http://example.com/hotel')
    })

    it('keeps query strings and fragments, which booking links rely on', () => {
      expect(safeExternalUrl('https://example.com/s?q=rome&n=2#map')).toBe('https://example.com/s?q=rome&n=2#map')
    })

    it('keeps a port and a non-ASCII path', () => {
      expect(safeExternalUrl('https://example.com:8443/caffè')).toBe('https://example.com:8443/caff%C3%A8')
    })
  })

  describe('refuses executable and local schemes', () => {
    it('refuses javascript:', () => {
      expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    })

    // The URL parser lowercases the scheme, so this can't sneak past.
    it('refuses JavaScript: regardless of case', () => {
      expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBeNull()
    })

    // Browsers strip tabs/newlines before reading the scheme, so this really
    // does execute in an href. A startsWith('javascript:') check would miss it;
    // parsing with URL does not.
    it('refuses javascript: broken up by a tab or newline', () => {
      expect(safeExternalUrl('java\tscript:alert(1)')).toBeNull()
      expect(safeExternalUrl('java\nscript:alert(1)')).toBeNull()
      expect(safeExternalUrl('  javascript:alert(1)  ')).toBeNull()
    })

    it('refuses data:', () => {
      expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
      expect(safeExternalUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeNull()
    })

    it('refuses file:', () => {
      expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
      expect(safeExternalUrl('file://C:/Windows/System32')).toBeNull()
    })

    it('refuses other non-web schemes', () => {
      expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull()
      expect(safeExternalUrl('blob:https://example.com/abc')).toBeNull()
      expect(safeExternalUrl('mailto:someone@example.com')).toBeNull()
    })
  })

  describe('refuses anything that is not an absolute URL', () => {
    it.each([
      ['empty', ''],
      ['whitespace only', '   '],
      ['a bare hostname', 'example.com'],
      ['a relative path', '/patches/1'],
      ['protocol-relative', '//example.com'],
      ['a scheme with no host', 'https://'],
      ['nonsense', 'not a url at all'],
    ])('refuses %s', (_label, input) => {
      expect(safeExternalUrl(input)).toBeNull()
    })

    it('refuses null and undefined', () => {
      expect(safeExternalUrl(null)).toBeNull()
      expect(safeExternalUrl(undefined)).toBeNull()
    })
  })

  // Callers put the return value straight into an href, so what comes back has
  // to be the string that was actually inspected.
  it('returns the parsed form rather than the raw input', () => {
    expect(safeExternalUrl('https://Example.COM')).toBe('https://example.com/')
  })
})
