import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_TOLERANCE_DAYS = 14

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

/** GET ?date=YYYY-MM-DD&issuesOnly=true|false — certificates expiring on that day */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dateStr = request.nextUrl.searchParams.get('date')
  const issuesOnly = request.nextUrl.searchParams.get('issuesOnly') === 'true'
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })
  }

  try {
    const documents: any[] = []

    const { data: drivers } = await supabase
      .from('drivers')
      .select('employee_id, tas_badge_expiry_date, taxi_badge_expiry_date, dbs_expiry_date, first_aid_certificate_expiry_date, passport_expiry_date, driving_license_expiry_date, cpc_expiry_date, vehicle_insurance_expiry_date, mot_expiry_date, employees(full_name)')

    const driverList = Array.isArray(drivers) ? drivers : []
    for (const d of driverList) {
      const emp = Array.isArray((d as any).employees) ? (d as any).employees[0] : (d as any).employees
      const fullName = emp?.full_name ?? 'Unknown'
      for (const { key, label } of DRIVER_EXPIRY_FIELDS) {
        const val = (d as any)[key]
        if (val == null) continue
        const expiryStr = typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10)
        if (expiryStr !== dateStr) continue
        const daysRemaining = getDaysRemaining(expiryStr)
        const status = getStatus(daysRemaining)
        if (issuesOnly && status !== 'expiring_soon' && status !== 'expired') continue
        documents.push({
          source: 'driver',
          entity_type: 'driver',
          entity_id: (d as any).employee_id,
          profile_url: `/dashboard/drivers/${(d as any).employee_id}`,
          entity_name: fullName,
          doc_type: label,
          expiry_date: expiryStr,
          days_remaining: daysRemaining,
          status,
        })
      }
    }

    const { data: pas } = await supabase
      .from('passenger_assistants')
      .select('id, employee_id, tas_badge_expiry_date, dbs_expiry_date, employees(full_name)')

    const paList = Array.isArray(pas) ? pas : []
    for (const p of paList) {
      const emp = Array.isArray((p as any).employees) ? (p as any).employees[0] : (p as any).employees
      const fullName = emp?.full_name ?? 'Unknown'
      for (const { key, label } of PA_EXPIRY_FIELDS) {
        const val = (p as any)[key]
        if (val == null) continue
        const expiryStr = typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10)
        if (expiryStr !== dateStr) continue
        const daysRemaining = getDaysRemaining(expiryStr)
        const status = getStatus(daysRemaining)
        if (issuesOnly && status !== 'expiring_soon' && status !== 'expired') continue
        documents.push({
          source: 'assistant',
          entity_type: 'assistant',
          entity_id: (p as any).id,
          profile_url: `/dashboard/assistants/${(p as any).id}`,
          entity_name: fullName,
          doc_type: label,
          expiry_date: expiryStr,
          days_remaining: daysRemaining,
          status,
        })
      }
    }

    return NextResponse.json({ date: dateStr, documents })
  } catch (err: any) {
    console.error('Employee calendar day error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
