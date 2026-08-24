import type { PropsWithChildren } from 'react'

interface PageContainerProps extends PropsWithChildren {
  className?: string
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return <div className={['page', className].filter(Boolean).join(' ')}>{children}</div>
}
