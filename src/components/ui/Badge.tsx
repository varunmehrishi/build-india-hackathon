import type { PropsWithChildren } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'accent'

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={['badge', `badge-${tone}`].join(' ')}>{children}</span>
}
