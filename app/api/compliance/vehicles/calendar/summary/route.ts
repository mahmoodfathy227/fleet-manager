import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getVehicleExpiryForDocType,
  getExpiryStatus,
  getVehicleExpiryDates,
  DEFAULT_TOLERANCE_DAYS,
} from '@/lib/complianceCalendar'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month (YYYY-MM) required' }, { status: 400 })
  }

  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(year, monthNum - 1, 1)
  const endDate = new Date(year, monthNum, 0)
  const startStr = startDate.toISOString().slice(0, 19)
  const endStr = endDate.toISOString().slice(0, 10) + 'T23:59:59.999'

  try {
    const { data: toleranceRows } = await supabase
      .from('document_expiry_tolerance')
      .select('document_type_key, tolerance_days')
    const defaultTolerance =
      Number(toleranceRows?.find((r) => r.document_type_key == null)?.tolerance_days) || DEFAULT_TOLERANCE_DAYS
    const toleranceByKey: Record<string, number> = {}
    toleranceRows?.forEach((r) => {
      if (r.document_type_key) toleranceByKey[r.document_type_key] = Number(r.tolerance_days) || defaultTolerance
    })

    const { data: docsInMonth, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .gte('uploaded_at', startStr)
      .lte('uploaded_at', endStr)

    if (docsError) {
      console.error('Calendar summary docs error:', docsError)
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    const docIds = (docsInMonth ?? []).map((d: { id: number }) => d.id)
    const byDate: Record<string, { total_docs: number; has_issue: boolean }> = {}
    const monthStartStr = startDate.toISOString().slice(0, 10)
    const monthEndStr = endStr.slice(0, 10)

    // 1) Uploaded documents (document_vehicle_links + documents)
    if (docIds.length > 0) {
      const { data: links, error } = await supabase
        .from('document_vehicle_links')
        .select(
          `
          created_at,
          documents (
            id,
            doc_type,
            uploaded_at
          ),
          vehicles (
            id,
            registration,
            vehicle_identifier,
            insurance_expiry_date,
            mot_date,
            tax_date,
            registration_expiry_date,
            plate_expiry_date,
            loler_expiry_date,
            first_aid_expiry,
            fire_extinguisher_expiry
          )
        `
        )
        .in('document_id', docIds)

      if (!error && Array.isArray(links)) {
        for (const row of links) {
          const doc = (row as any).documents
          const vehicle = (row as any).vehicles
          if (!doc || !vehicle) continue
          const uploadedAt = doc.uploaded_at
          if (!uploadedAt) continue
          const docDate = new Date(uploadedAt).toISOString().slice(0, 10)
          if (docDate < monthStartStr || docDate > monthEndStr) continue

          if (!byDate[docDate]) byDate[docDate] = { total_docs: 0, has_issue: false }
          byDate[docDate].total_docs += 1

          const tolerance = toleranceByKey[doc.doc_type ?? ''] ?? defaultTolerance
          const expiryDate = getVehicleExpiryForDocType(vehicle, doc.doc_type)
          const status = getExpiryStatus(expiryDate, tolerance)
          if (status === 'expiring_soon' || status === 'expired') {
            byDate[docDate].has_issue = true
          }
        }
      }
    }

    // 2) Dynamic vehicle requirements (subject_documents for vehicles)
    const { data: subjectDocsInMonth } = await supabase
      .from('subject_documents')
      .select('id, created_at, expiry_date, requirement_id, document_requirements(name, renewal_notice_days)')
      .not('vehicle_id', 'is', null)
      .gte('created_at', startStr)
      .lte('created_at', endStr)

    const subjectList = Array.isArray(subjectDocsInMonth) ? subjectDocsInMonth : []
    for (const row of subjectList) {
      const created = (row as any).created_at
      if (!created) continue
      const docDate = new Date(created).toISOString().slice(0, 10)
      if (docDate < monthStartStr || docDate > monthEndStr) continue

      if (!byDate[docDate]) byDate[docDate] = { total_docs: 0, has_issue: false }
      byDate[docDate].total_docs += 1

      const expiryDate = (row as any).expiry_date
      const req = (row as any).document_requirements
      const tolerance = req?.renewal_notice_days != null ? Number(req.renewal_notice_days) : defaultTolerance
      const status = getExpiryStatus(expiryDate, tolerance)
      if (status === 'expiring_soon' || status === 'expired') {
        byDate[docDate].has_issue = true
      }
    }

    // 3) Vehicle create fields: expiry dates as event days (insurance_expiry_date, mot_date, etc.)
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, registration_expiry_date, plate_expiry_date, insurance_expiry_date, mot_date, tax_date, loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry')

    const vehicleList = Array.isArray(vehicles) ? vehicles : []
    for (const vehicle of vehicleList) {
      const expiryEntries = getVehicleExpiryDates(vehicle)
      for (const { date } of expiryEntries) {
        if (date < monthStartStr || date > monthEndStr) continue
        if (!byDate[date]) byDate[date] = { total_docs: 0, has_issue: false }
        byDate[date].total_docs += 1
        const status = getExpiryStatus(date, defaultTolerance)
        if (status === 'expiring_soon' || status === 'expired') {
          byDate[date].has_issue = true
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
    console.error('Calendar summary error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
