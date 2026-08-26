import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'

interface CompletionDialogProps {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}

export function CompletionDialog({ title, eyebrow, children, onClose, wide = false }: CompletionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = `completion-dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')?.focus()
    return () => previousFocus?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="completion-dialog-layer" role="presentation">
      <div
        ref={dialogRef}
        className={`completion-dialog${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className="completion-dialog-header">
          <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2 id={titleId}>{title}</h2></div>
          <Button variant="ghost" onClick={onClose} aria-label={`Close ${title}`}>Close</Button>
        </header>
        <div className="completion-dialog-body">{children}</div>
      </div>
    </div>
  )
}
