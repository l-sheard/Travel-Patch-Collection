import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { PlusIcon } from './layout/icons'

export type PendingDish = { name: string; file: File }

type Props = {
  value: PendingDish[]
  onChange: (value: PendingDish[]) => void
}

function DishThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return null
  return <img src={url} alt="" className="h-full w-full object-cover" />
}

export default function DishesInput({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onChange([...value, { name: '', file }])
  }

  function updateName(index: number, name: string) {
    onChange(value.map((d, i) => (i === index ? { ...d, name } : d)))
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {value.map((dish, i) => (
          <div key={i} className="flex w-24 flex-col gap-1.5">
            <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-ink/10">
              <DishThumb file={dish.file} />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-xs text-cream"
                aria-label="Remove dish"
              >
                ×
              </button>
            </div>
            <input
              type="text"
              value={dish.name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder="Dish name"
              className="w-24 rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-teal/30 text-teal hover:bg-teal/5"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="text-[11px] font-medium">Add dish</span>
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSelect} />
    </div>
  )
}
