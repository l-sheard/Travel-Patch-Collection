import { useState, type KeyboardEvent } from 'react'

type Props = {
  value: string[]
  onChange: (value: string[]) => void
}

export default function CompanionsInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function addTag() {
    const trimmed = draft.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-mustard/20 px-2.5 py-1 text-xs font-medium text-ink/80"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-ink/40 hover:text-terracotta-dark"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
        placeholder={value.length ? '' : 'Add a name and press Enter'}
        className="min-w-32 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  )
}
