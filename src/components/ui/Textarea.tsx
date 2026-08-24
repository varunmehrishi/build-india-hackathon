import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="field">
      <label className="field-label" htmlFor={textareaId}>{label}</label>
      <textarea
        id={textareaId}
        className={['input', 'textarea', error ? 'input-error' : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        {...props}
      />
      {error ? (
        <span className="field-error" id={`${textareaId}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
