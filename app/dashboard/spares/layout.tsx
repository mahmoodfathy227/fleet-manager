'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Car, UserCog, UserCheck, Wrench } from 'lucide-react'

const tabs = [
  { name: 'Spare Vehicles', href: '/dashboard/spares/vehicles', icon: Car },
  { name: 'Spare Drivers', href: '/dashboard/spares/drivers', icon: UserCog },
  { name: 'Spare PAs', href: '/dashboard/spares/assistants', icon: UserCheck },
]

export default function SparesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Wrench className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Spares</h1>
          <p className="text-sm text-slate-500">
            Spare vehicles, spare drivers, and spare PAs — available for use when not assigned to a route
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1" aria-label="Spares sub-tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={true}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </Link>
            )
          })}
        </nav>
      </div>

      {children}
    </div>
  )
}
