'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Car, Users, Route, CalendarDays, Info, Filter, MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ComplianceVehicleCalendarClient } from '@/app/dashboard/compliance/vehicles/calendar/ComplianceVehicleCalendarClient'
import { ComplianceEmployeeCalendarClient } from './ComplianceEmployeeCalendarClient'
import { RouteUpdatesCalendarView } from './RouteUpdatesCalendarView'
import { OperationsCalendarClient } from './OperationsCalendarClient'

type CalendarTab = 'operations' | 'vehicles' | 'employees' | 'route-updates'

const TABS: { id: CalendarTab; label: string; icon: typeof Car }[] = [
  { id: 'operations', label: 'Routes & schools', icon: CalendarDays },
  { id: 'vehicles', label: 'Compliance (Vehicles)', icon: Car },
  { id: 'employees', label: 'Compliance (Employees)', icon: Users },
  { id: 'route-updates', label: 'Route updates', icon: Route },
]

const isValidTab = (s: string | null): s is CalendarTab =>
  s === 'operations' || s === 'vehicles' || s === 'employees' || s === 'route-updates'

export function CalendarView() {
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get('tab') ?? null
  const [activeTab, setActiveTab] = useState<CalendarTab>(isValidTab(tabParam) ? tabParam : 'operations')

  useEffect(() => {
    if (isValidTab(tabParam)) setActiveTab(tabParam)
  }, [tabParam])

  useEffect(() => {
    console.debug('[fleet] CalendarView: default tab routes & schools (operations); legacy tabs unchanged')
  }, [])

  useEffect(() => {
    if (activeTab === 'operations') {
      console.debug('[CalendarView] operations tab: structured legend panel (blue/red dots + filter/day tips)')
    }
    if (activeTab === 'employees') {
      console.debug('[CalendarView] employees tab: structured certificate legend (blue/red dots)')
    }
    if (activeTab === 'vehicles') {
      console.debug('[CalendarView] vehicles tab: structured document legend (blue/red dots)')
    }
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Operations calendar (routes by school), vehicle and employee compliance, and route notes — switch tabs below.
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
        {activeTab === 'operations' && (
          <div className="space-y-4">
            <section
              className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm"
              aria-labelledby="operations-calendar-legend-heading"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Info className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <h2
                      id="operations-calendar-legend-heading"
                      className="text-sm font-semibold text-slate-900"
                    >
                      How this calendar works
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Dots summarize what needs attention. Use filters above the calendar to narrow by school and route.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                        <span
                          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-sm ring-2 ring-blue-200"
                          aria-hidden
                        />
                        Blue dots
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-900/90">
                        <li>Route sessions scheduled</li>
                        <li>Route updates</li>
                        <li>Passenger or parent updates</li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-900">
                        <span
                          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-sm ring-2 ring-red-200"
                          aria-hidden
                        />
                        Red dots
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-900/90">
                        <li>Crew certificate expiring or expired (that session day)</li>
                        <li>Parent trip cancellation</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span>
                        <span className="font-medium text-slate-700">Filter</span> by school and route to focus the grid.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span>
                        <span className="font-medium text-slate-700">Open a day</span> for session details, spare driver
                        assignment, and compliance warnings.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <OperationsCalendarClient />
          </div>
        )}
        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            <section
              className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm"
              aria-labelledby="vehicles-calendar-legend-heading"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Car className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <h2
                      id="vehicles-calendar-legend-heading"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Vehicle documents &amp; certificates
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Fleet vehicle paperwork (e.g. insurance, MOT, PHV). Blue highlights days with something due; red means
                      expiry risk or already past due.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                        <span
                          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-sm ring-2 ring-blue-200"
                          aria-hidden
                        />
                        Blue dots
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-900/90">
                        <li>That day has vehicle documents or certificates due (e.g. insurance, MOT, PHV checks)</li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-900">
                        <span
                          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-sm ring-2 ring-red-200"
                          aria-hidden
                        />
                        Red dots
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-900/90">
                        <li>At least one document or certificate is expiring soon</li>
                        <li>At least one is already expired</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600">
                    <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span>
                      <span className="font-medium text-slate-700">Open a day</span> to see which vehicles and documents apply,
                      and to renew or upload proof before deadlines.
                    </span>
                  </div>
                </div>
              </div>
            </section>
            <ComplianceVehicleCalendarClient />
          </div>
        )}
        {activeTab === 'employees' && (
          <div className="space-y-4">
            <section
              className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-sm"
              aria-labelledby="employees-calendar-legend-heading"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <h2
                      id="employees-calendar-legend-heading"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Driver &amp; passenger assistant certificates
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Tracks certificate dates for drivers and PAs. Dots show whether a day needs routine follow-up (blue) or
                      urgent attention (red).
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                        <span
                          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-sm ring-2 ring-blue-200"
                          aria-hidden
                        />
                        Blue dots
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-900/90">
                        <li>That day has one or more driver or PA certificates due</li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-900">
                        <span
                          className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-sm ring-2 ring-red-200"
                          aria-hidden
                        />
                        Red dots
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-900/90">
                        <li>At least one certificate is expiring soon</li>
                        <li>At least one certificate is already expired</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600">
                    <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span>
                      <span className="font-medium text-slate-700">Open a day</span> to see which crew members and certificates
                      apply, and to act on compliance warnings.
                    </span>
                  </div>
                </div>
              </div>
            </section>
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
