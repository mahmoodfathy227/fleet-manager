import { Suspense } from 'react'
import { CalendarView } from './CalendarView'

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
            <p className="mt-1 text-sm text-slate-600">
              View compliance events and route updates in one place.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
            Loading calendar…
          </div>
        </div>
      }
    >
      <CalendarView />
    </Suspense>
  )
}
