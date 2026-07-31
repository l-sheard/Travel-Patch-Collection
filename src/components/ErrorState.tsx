type Props = {
  message?: string
}

export default function ErrorState({ message = "Something went wrong loading your patches." }: Props) {
  return (
    <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 px-5 py-4 text-sm text-terracotta-dark">
      {message} Try refreshing the page.
    </div>
  )
}
