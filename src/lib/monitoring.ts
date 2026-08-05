// Optional: only active when a Sentry DSN is configured. Dynamically imported
// so the SDK never ships in the bundle for deployments that don't set it.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

export const isMonitoringEnabled = Boolean(dsn)

export function initMonitoring() {
  if (!dsn) return
  import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 })
  })
}

export function reportError(error: unknown, componentStack?: string) {
  if (!dsn) return
  import('@sentry/react').then((Sentry) => {
    Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined)
  })
}
