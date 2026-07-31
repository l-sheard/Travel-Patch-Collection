import { useEffect, useRef, useState } from 'react'
import { countries } from '../lib/countries'

type Props = {
  value: string
  onChange: (value: string) => void
}

export default function CountryInput({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = (
    value.trim() ? countries.filter((c) => c.toLowerCase().includes(value.trim().toLowerCase())) : countries
  ).slice(0, 8)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Italy"
        autoComplete="off"
        className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-lg">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c)
                setOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-teal/10"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
