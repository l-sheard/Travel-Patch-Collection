import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { PlusIcon } from './layout/icons'

export type PendingDish = { name: string; file: File | null }

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

function DishRow({
  dish,
  onUpdate,
  onRemove,
}: {
  dish: PendingDish
  onUpdate: (patch: Partial<PendingDish>) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onUpdate({ file })
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white/60 p-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-teal/30 text-teal hover:bg-teal/5"
        aria-label={dish.file ? 'Change photo' : 'Add photo (optional)'}
      >
        {dish.file ? <DishThumb file={dish.file} /> : <PlusIcon className="h-4 w-4" />}
      </button>

      <input
        type="text"
        value={dish.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="Dish name"
        className="flex-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />

      {dish.file && (
        <button
          type="button"
          onClick={() => onUpdate({ file: null })}
          className="shrink-0 text-xs text-ink/40 hover:text-terracotta-dark"
        >
          Remove photo
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink/40 hover:text-terracotta-dark"
        aria-label="Remove dish"
      >
        ×
      </button>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
    </div>
  )
}

export default function DishesInput({ value, onChange }: Props) {
  function updateAt(index: number, patch: Partial<PendingDish>) {
    onChange(value.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...value, { name: '', file: null }])
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((dish, i) => (
        <DishRow key={i} dish={dish} onUpdate={(patch) => updateAt(i, patch)} onRemove={() => removeAt(i)} />
      ))}

      <button
        type="button"
        onClick={add}
        className="self-start rounded-full border-2 border-dashed border-teal/30 px-3 py-1.5 text-xs font-medium text-teal hover:bg-teal/5"
      >
        + Add a dish
      </button>
    </div>
  )
}
