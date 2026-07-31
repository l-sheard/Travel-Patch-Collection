import type { ReactNode } from 'react'

type PlaceholderPageProps = {
  title: string
  description: string
  icon: (props: { className?: string }) => ReactNode
}

export default function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal/30 bg-white/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-teal">
        <Icon className="h-8 w-8" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-teal-dark">{title}</h1>
      <p className="max-w-sm text-sm text-ink/60">{description}</p>
    </div>
  )
}
