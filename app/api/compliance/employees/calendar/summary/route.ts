import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_TOLERANCE_DAYS = 14

/** Driver expiry columns: label -> column key */
const DRIVER_EXPIRY_FIELDS: { key: string; label: string }[] = [
  { key: 'tas_badge_expiry_date', label: 'TAS Badge' },
  { key: 'taxi_badge_expiry_date', label: 'Taxi Badge' },
  { key: 'dbs_expiry_date', label: 'DBS' },
  { key: 'first_aid_certificate_expiry_date', label: 'First Aid Certificate' },
  { key: 'passport_expiry_date', label: 'Passport' },
  { key: 'driving_license_expiry_date', label: 'Driving License' },
  { key: 'cpc_expiry_date', label: 'CPC' },
  { key: 'vehicle_insurance_expiry_date', label: 'Vehicle Insurance' },
  { key: 'mot_expiry_date', label: 'MOT' },
]

/** PA expiry columns */
const PA_EXPIRY_FIELDS: { key: string; label: string }[] = [
  { key: 'tas_badge_expiry_date', label: 'TAS Badge' },
  { key: 'dbs_expiry_date', label: 'DBS' },
]

function getDaysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getStatus(daysRemaining: number | null): 'ok' | 'expiring_soon' | 'expired' {
  if (daysRemaining === null) return 'ok'
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= DEFAULT_TOLERANCE_DAYS) return 'expiring_soon'
  return 'ok'
}

export const dynamic = 'force-dynamic'

/** GET ?month=YYYY-MM — summary of employee certificate events per day */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const month = request.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month (YYYY-MM) required' }, { status: 400 })
  }

  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(year, monthNum - 1, 1)
  const endDate = new Date(year, monthNum, 0)
  const monthStartStr = startDate.toISOString().slice(0, 10)
  const monthEndStr = endDate.toISOString().slice(0, 10)

  try {
    const byDate: Record<string, { total_docs: number; has_issue: boolean }> = {}

    const { data: drivers } = await supabase
      .from('drivers')
      .select('employee_id, tas_badge_expiry_date, taxi_badge_expiry_date, dbs_expiry_date, first_aid_certificate_expiry_date, passport_expiry_date, driving_license_expiry_date, cpc_expiry_date, vehicle_insurance_expiry_date, mot_expiry_date, employees(full_name)')

    const driverList = Array.isArray(drivers) ? drivers : []
    for (const d of driverList) {
      for (const { key } of DRIVER_EXPIRY_FIELDS) {
        const val = (d as any)[key]
        if (val == null) continue
        const dateStr = typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10)
        if (dateStr < monthStartStr || dateStr > monthEndStr) continue
        if (!byDate[dateStr]) byDate[dateStr] = { total_docs: 0, has_issue: false }
        byDate[dateStr].total_docs += 1
        const days = getDaysRemaining(dateStr)
        if (getStatus(days) === 'expiring_soon' || getStatus(days) === 'expired') {
          byDate[dateStr].has_issue = true
        }
      }
    }

    const { data: pas } = await supabase
      .from('passenger_assistants')
      .select('id, employee_id, tas_badge_expiry_date, dbs_expiry_date, employees(full_name)')

    const paList = Array.isArray(pas) ? pas : []
    for (const p of paList) {
      for (const { key } of PA_EXPIRY_FIELDS) {
        const val = (p as any)[key]
        if (val == null) continue
        const dateStr = typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10)
        if (dateStr < monthStartStr || dateStr > monthEndStr) continue
        if (!byDate[dateStr]) byDate[dateStr] = { total_docs: 0, has_issue: false }
        byDate[dateStr].total_docs += 1
        const days = getDaysRemaining(dateStr)
        if (getStatus(days) === 'expiring_soon' || getStatus(days) === 'expired') {
          byDate[dateStr].has_issue = true
        }
      }
    }

    const summary = Object.entries(byDate).map(([date, v]) => ({
      date,
      total_docs: v.total_docs,
      has_issue: v.has_issue,
    }))

    return NextResponse.json({ summary })
  } catch (err: any) {
    console.error('Employee calendar summary error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
