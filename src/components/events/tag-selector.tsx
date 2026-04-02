'use client'

import { useState, useTransition } from 'react'
import { createTag } from '@/lib/actions/tags'

type Tag = { id: string; name: string }

type Props = {
  availableTags: Tag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
}

export function TagSelector({ availableTags, selectedTagIds, onChange }: Props) {
  const [tags, setTags] = useState(availableTags)
  const [newTagName, setNewTagName] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggleTag(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  function handleCreateTag() {
    if (!newTagName.trim()) return
    startTransition(async () => {
      const tag = await createTag(newTagName)
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...selectedTagIds, tag.id])
      setNewTagName('')
    })
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)]">Tags</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTagIds.includes(tag.id)
                ? 'bg-[var(--brand-accent)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
          placeholder="New tag..."
          className="flex-1 rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCreateTag}
          disabled={isPending || !newTagName.trim()}
          className="rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}
