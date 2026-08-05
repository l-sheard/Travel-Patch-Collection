import { Component, type ErrorInfo, type ReactNode } from 'react'
import { StampIcon } from './layout/icons'
import { reportError } from '../lib/monitoring'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? undefined)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/10 text-terracotta-dark">
          <StampIcon className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-teal-dark">Something went wrong</h1>
        <p className="max-w-sm text-sm text-ink/60">
          The app hit an unexpected error. Reloading usually fixes it — your data is safe in the cloud.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark"
        >
          Reload
        </button>
      </div>
    )
  }
}
