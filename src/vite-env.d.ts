/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_BG_REMOVAL_WORKER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
