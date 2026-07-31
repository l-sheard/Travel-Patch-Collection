import { useEffect, useRef, useState } from 'react'
import { FilterIcon } from './layout/icons'
import type { Continent } from '../lib/continents'

type Props = {
  continents: Continent[]
  continent: Continent | 'All'
  onContinentChange: (c: Continent | 'All') => void
  years: number[]
  year: number | 'All'
  onYearChange: (y: number | 'All') => void
}

export default function FilterMenu({ continents, continent, onContinentChange, years, year, onYearChange }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeCount = (continent !== 'All' ? 1 : 0) + (year !== 'All' ? 1 : 0)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function clearAll() {
    onContinentChange('All')
    onYearChange('All')
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
          activeCount > 0
            ? 'border-teal bg-teal/10 text-teal-dark'
            : 'border-ink/15 bg-white text-ink/70 hover:border-teal/40 hover:text-teal-dark'
        }`}
      >
        <FilterIcon className="h-4 w-4" />
        Filter
        {activeCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[10px] font-semibold text-cream">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-ink/10 bg-white p-4 shadow-lg">
          {continents.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Continent</p>
              <div className="flex flex-wrap gap-2">
                {(['All', ...continents] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onContinentChange(c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      continent === c
                        ? 'bg-teal text-cream'
                        : 'border border-ink/15 bg-white text-ink/60 hover:border-teal/40 hover:text-teal-dark'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {years.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Year</p>
              <div className="flex flex-wrap gap-2">
                {(['All', ...years] as const).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onYearChange(y)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      year === y
                        ? 'bg-mustard text-ink'
                        : 'border border-ink/15 bg-white text-ink/60 hover:border-mustard/50 hover:text-ink'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 w-full rounded-full border border-ink/15 py-1.5 text-xs font-medium text-ink/60 hover:text-terracotta-dark"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
