'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface LoadingLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  prefetch?: boolean
  onClick?: () => void
}

export function LoadingLink({ 
  href, 
  children, 
  className, 
  prefetch = true,
  onClick 
}: LoadingLinkProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    startTransition(() => {
      router.push(href)
      onClick?.()
    })
  }

  return (
    <Link 
      href={href} 
      onClick={handleClick}
      prefetch={prefetch}
      className={cn(
        isPending && 'opacity-70 cursor-wait',
        className
      )}
    >
      {children}
    </Link>
  )
}

