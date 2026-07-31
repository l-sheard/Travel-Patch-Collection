import { HOLIDAY_TYPES } from '../lib/holidayTypes'

type Props = {
  value: string[]
  onChange: (value: string[]) => void
}

export default function HolidayTypeInput({ value, onChange }: Props) {
  function toggle(type: string) {
    onChange(value.includes(type) ? value.filter((t) => t !== type) : [...value, type])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {HOLIDAY_TYPES.map((type) => {
        const checked = value.includes(type)
        return (
          <label
            key={type}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              checked
                ? 'border-teal bg-teal text-cream'
                : 'border-ink/15 bg-white text-ink/60 hover:border-teal/40 hover:text-teal-dark'
            }`}
          >
            <input type="checkbox" checked={checked} onChange={() => toggle(type)} className="sr-only" />
            {type}
          </label>
        )
      })}
    </div>
  )
}
