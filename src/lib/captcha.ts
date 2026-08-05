// Optional: only enabled when a Cloudflare Turnstile site key is configured.
// Free, no paid API key — see README for setup.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export const isCaptchaEnabled = Boolean(TURNSTILE_SITE_KEY)
