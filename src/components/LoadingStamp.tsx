import { StampIcon } from './layout/icons'

export default function LoadingStamp({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <span
      title="Removing background…"
      className={`inline-flex items-center justify-center rounded-full bg-teal/90 text-cream shadow-sm ${className}`}
    >
      <StampIcon className="h-3.5 w-3.5 animate-stamp-press" />
    </span>
  )
}
