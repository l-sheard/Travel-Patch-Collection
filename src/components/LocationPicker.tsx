import { useEffect, useRef, useState } from 'react'
import { searchLocations, type GeocodeResult } from '../lib/geocode'

type Props = {
  value: string
  onChange: (value: string) => void
  onSelect: (result: GeocodeResult) => void
}

export default function LocationPicker({ value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.trim().length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      setLoading(true)
      searchLocations(value, controller.signal)
        .then((r) => {
          setResults(r)
          setOpen(true)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 400)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [value])

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
        required
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="e.g. Florence"
        autoComplete="off"
        className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />

      {open && (loading || results.length > 0) && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-ink/10 bg-white shadow-lg">
          {loading && <p className="px-3 py-2 text-xs text-ink/40">Searching…</p>}
          {!loading &&
            results.map((result, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelect(result)
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-teal/10"
              >
                <span className="font-medium text-ink">{result.name}</span>
                <span className="block text-xs text-ink/50">{result.displayName}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
