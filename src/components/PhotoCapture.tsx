import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { PlusIcon } from './layout/icons'

type Props = {
  files: File[]
  onChange: (files: File[]) => void
  max?: number
  addLabel?: string
}

function PhotoThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!url) return null
  return <img src={url} alt="" className="h-full w-full object-cover" />
}

export default function PhotoCapture({ files, onChange, max, addLabel = 'Add photo' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = max !== undefined && files.length >= max

  function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    const combined = max !== undefined ? [...files, ...selected].slice(0, max) : [...files, ...selected]
    onChange(combined)
    e.target.value = ''
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-wrap gap-3">
      {files.map((file, i) => (
        <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl border border-ink/10">
          <PhotoThumb file={file} />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-xs text-cream"
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ))}

      {!atLimit && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-teal/30 text-teal hover:bg-teal/5"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="text-[11px] font-medium">{addLabel}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={max !== 1}
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  )
}
