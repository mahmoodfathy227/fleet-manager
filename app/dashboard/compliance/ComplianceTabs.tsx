'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ClipboardCheck, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ComplianceTabs() {
  const pathname = usePathname()
  const isCases = pathname?.startsWith('/dashboard/compliance/cases')
  const isNotifications =
    pathname === '/dashboard/compliance' || pathname === '/dashboard/compliance/'

  useEffect(() => {
    console.debug('[fleet] ComplianceTabs: Reminder list + Updates tab labels')
  }, [])

  return (
    <div className="space-y-2">
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 flex-wrap" aria-label="Certificate compliance sections">
          <Link
            href="/dashboard/compliance"
            prefetch={true}
            className={cn(
              'flex flex-col items-start gap-0.5 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors min-w-[10rem]',
              isNotifications
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            <span className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />
              Reminder list
            </span>
            <span className="text-xs font-normal text-slate-500 leading-snug pl-6">
              Who needs paperwork soon
            </span>
          </Link>
          <Link
            href="/dashboard/compliance/cases"
            prefetch={true}
            className={cn(
              'flex flex-col items-start gap-0.5 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors min-w-[10rem]',
              isCases
                ? 'border-primary text-primary bg-primary/10'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              Updates
            </span>
            <span className="text-xs font-normal text-slate-500 leading-snug pl-6">
              Work one item in detail
            </span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
