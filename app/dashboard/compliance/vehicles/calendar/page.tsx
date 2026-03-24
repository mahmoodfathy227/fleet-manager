import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Redirect to merged calendar with Vehicles tab. */
export default function ComplianceVehiclesCalendarPage() {
  redirect('/dashboard/calendar?tab=vehicles')
}
