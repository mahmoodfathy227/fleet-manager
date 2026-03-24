'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Car, Users, Route } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ComplianceVehicleCalendarClient } from '@/app/dashboard/compliance/vehicles/calendar/ComplianceVehicleCalendarClient'
import { ComplianceEmployeeCalendarClient } from './ComplianceEmployeeCalendarClient'
import { RouteUpdatesCalendarView } from './RouteUpdatesCalendarView'

type CalendarTab = 'vehicles' | 'employees' | 'route-updates'

const TABS: { id: CalendarTab; label: string; icon: typeof Car }[] = [
  { id: 'vehicles', label: 'Compliance (Vehicles)', icon: Car },
  { id: 'employees', label: 'Compliance (Employees)', icon: Users },
  { id: 'route-updates', label: 'Route updates', icon: Route },
]

const isValidTab = (s: string | null): s is CalendarTab =>
  s === 'vehicles' || s === 'employees' || s === 'route-updates'

export function CalendarView() {
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab') ?? null
  const [activeTab, setActiveTab] = useState<CalendarTab>(isValidTab(tabParam) ? tabParam : 'vehicles')

  useEffect(() => {
    if (isValidTab(tabParam)) setActiveTab(tabParam)
  }, [tabParam])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <p className="mt-1 text-sm text-slate-600">
          View compliance events and route updates in one place. Use the tabs to filter by vehicles, employees, or route updates.
        </p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1 flex-wrap" aria-label="Calendar tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'vehicles' && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Vehicle documents and certificates. Blue dot = day has documents; red dot = at least one expiring soon or expired.
            </p>
            <ComplianceVehicleCalendarClient />
          </div>
        )}
        {activeTab === 'employees' && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Driver and passenger assistant certificate expiries. Blue dot = day has certificates due; red dot = at least one expiring soon or expired.
            </p>
            <ComplianceEmployeeCalendarClient />
          </div>
        )}
        {activeTab === 'route-updates' && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Click a day to view or add route updates. Days with updates show a dot until you view them.
            </p>
            <RouteUpdatesCalendarView />
          </div>
        )}
      </div>
    </div>
  )
}
