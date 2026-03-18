import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ComplianceVehicleCalendarClient } from './ComplianceVehicleCalendarClient'

export const dynamic = 'force-dynamic'

export default async function ComplianceVehiclesCalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vehicle Documents Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Fleet document events by date. Blue = documents recorded; red = at least one document expiring soon.
        </p>
      </div>
      <ComplianceVehicleCalendarClient />
    </div>
  )
}
