import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
}

export function Select({ label, error, className = '', id, children, ...props }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="field">
      <label className="field-label" htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        className={['input', 'select', error ? 'input-error' : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span className="field-error" id={`${selectId}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
