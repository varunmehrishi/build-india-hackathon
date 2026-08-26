import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

interface ProfileMenuProps {
  name: string
  onSave: (name: string) => void
  editable?: boolean
}

export function ProfileMenu({ name, onSave, editable = true }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isOpen])

  function save(event: React.FormEvent) {
    event.preventDefault()
    const normalized = draftName.trim()
    if (normalized.length < 2) {
      setError('Enter a name with at least two characters.')
      return
    }
    onSave(normalized)
    setError('')
    setIsOpen(false)
  }

  if (!editable) {
    return (
      <div className="profile-trigger profile-trigger-locked" aria-label={`${name}. Party name locked during review and execution.`} title="Party name locked during review and execution">
        <span className="profile-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span>{name}</span>
        <span aria-hidden="true">🔒</span>
      </div>
    )
  }

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        type="button"
        className="profile-trigger"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Edit profile name for ${name}`}
        onClick={() => { setDraftName(name); setError(''); setIsOpen((current) => !current) }}
      >
        <span className="profile-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span>{name}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {isOpen ? (
        <form className="profile-popover" role="dialog" aria-label="Edit profile name" onSubmit={save}>
          <p className="eyebrow">Local profile</p>
          <Input
            id="profile-name"
            label="Your name"
            value={draftName}
            onChange={(event) => { setDraftName(event.target.value); setError('') }}
            error={error || undefined}
            autoFocus
          />
          <div className="action-stack">
            <Button type="submit">Save</Button>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
