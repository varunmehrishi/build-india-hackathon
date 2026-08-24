import type { HTMLAttributes, PropsWithChildren } from 'react'

interface CardProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  )
}
