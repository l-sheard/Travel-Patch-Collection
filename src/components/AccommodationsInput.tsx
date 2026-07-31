import StarRating from './StarRating'
import type { Accommodation } from '../types/patch'

type Props = {
  value: Accommodation[]
  onChange: (value: Accommodation[]) => void
}

const inputClass =
  'w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20'

export default function AccommodationsInput({ value, onChange }: Props) {
  function updateAt(index: number, patch: Partial<Accommodation>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...value, { name: '', url: null, rating: null, notes: null, nights: null, people: null }])
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((acc, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white/60 p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-1 flex-col gap-2">
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
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={acc.nights ?? ''}
                  onChange={(e) => updateAt(i, { nights: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Nights"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={0}
                  value={acc.people ?? ''}
                  onChange={(e) => updateAt(i, { people: e.target.value ? Number(e.target.value) : null })}
                  placeholder="People"
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/40 hover:text-terracotta-dark"
              aria-label="Remove place"
            >
              ×
            </button>
          </div>
          <StarRating value={acc.rating} onChange={(r) => updateAt(i, { rating: r })} size="text-base" />
          <textarea
            value={acc.notes ?? ''}
            onChange={(e) => updateAt(i, { notes: e.target.value || null })}
            placeholder="Notes about staying here..."
            rows={2}
            className={inputClass}
          />
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
