import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'

const PatchMap = lazy(() => import('./PatchMap'))

type Props = ComponentProps<typeof PatchMap>

export default function LazyPatchMap({ className = 'h-[70vh]', ...props }: Props) {
  return (
    <Suspense fallback={<div className={`${className} animate-pulse rounded-3xl bg-cream-dark/60`} />}>
      <PatchMap className={className} {...props} />
    </Suspense>
  )
}
