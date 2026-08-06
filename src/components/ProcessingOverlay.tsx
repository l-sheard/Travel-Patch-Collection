/** Cloudy frosted-glass effect shown over a photo while background removal
 * is running — the blur/tint slowly breathes in and out. */
export default function ProcessingOverlay() {
  return (
    <div
      className="animate-glass-pulse pointer-events-none absolute inset-0 overflow-hidden rounded-xl motion-reduce:animate-none motion-reduce:bg-white/25 motion-reduce:backdrop-blur-md"
      aria-hidden="true"
    />
  )
}
