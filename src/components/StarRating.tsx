type Props = {
  value: number | null
  onChange?: (value: number | null) => void
  readOnly?: boolean
  size?: string
}

export default function StarRating({ value, onChange, readOnly, size = 'text-xl' }: Props) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(value === star ? null : star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={`${size} leading-none ${readOnly ? 'cursor-default' : ''}`}
        >
          <span className={(value ?? 0) >= star ? 'text-mustard' : 'text-ink/20'}>★</span>
        </button>
      ))}
      {!readOnly && value != null && (
        <button
          type="button"
          onClick={() => onChange?.(null)}
          className="ml-1 text-xs text-ink/40 hover:text-terracotta-dark"
        >
          Clear
        </button>
      )}
    </div>
  )
}
