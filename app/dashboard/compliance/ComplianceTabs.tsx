'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardCheck, FolderOpen, Car, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ComplianceTabs() {
  const pathname = usePathname()
  const isCases = pathname?.startsWith('/dashboard/compliance/cases')
  const isVehiclesCalendar = pathname?.startsWith('/dashboard/compliance/vehicles')

  return (
    <div className="border-b border-slate-200">
      <nav className="flex gap-1 flex-wrap" aria-label="Compliance tabs">
        <Link
          href="/dashboard/compliance"
          prefetch={true}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
            !isCases && !isVehiclesCalendar
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
        >
          <ClipboardCheck className="h-4 w-4" />
          Notifications
        </Link>
        <Link
          href="/dashboard/compliance/cases"
          prefetch={true}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
            isCases
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
        >
          <FolderOpen className="h-4 w-4" />
          Cases
        </Link>
        <Link
          href="/dashboard/compliance/vehicles/calendar"
          prefetch={true}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
            isVehiclesCalendar
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
        >
          <Car className="h-4 w-4" />
          Vehicles
          <Calendar className="h-3.5 w-3.5 opacity-70" />
        </Link>
      </nav>
    </div>
  )
}
