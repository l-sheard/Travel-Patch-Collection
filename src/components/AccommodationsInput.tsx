import type { Accommodation } from '../types/patch'

type Props = {
  value: Accommodation[]
  onChange: (value: Accommodation[]) => void
}

const inputClass =
  'flex-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20'

export default function AccommodationsInput({ value, onChange }: Props) {
  function updateAt(index: number, patch: Partial<Accommodation>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...value, { name: '', url: null }])
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((acc, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={acc.name}
            onChange={(e) => updateAt(i, { name: e.target.value })}
            placeholder="Hotel or place name"
            className={inputClass}
          />
          <input
            type="url"
            value={acc.url ?? ''}
            onChange={(e) => updateAt(i, { url: e.target.value || null })}
            placeholder="Link (optional)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/40 hover:text-terracotta-dark"
            aria-label="Remove place"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="self-start rounded-full border-2 border-dashed border-teal/30 px-3 py-1.5 text-xs font-medium text-teal hover:bg-teal/5"
      >
        + Add a place
      </button>
    </div>
  )
}
