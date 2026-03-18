import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getVehicleExpiryForDocType,
  getExpiryStatus,
  getDaysRemaining,
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
  const dateStr = searchParams.get('date') // YYYY-MM-DD
  const issuesOnly = searchParams.get('issuesOnly') === 'true'
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })
  }

  const startOfDay = `${dateStr}T00:00:00`
  const endOfDay = `${dateStr}T23:59:59.999`

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

    const { data: docsInDay, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .gte('uploaded_at', startOfDay)
      .lte('uploaded_at', endOfDay)

    if (docsError) {
      console.error('Calendar day docs error:', docsError)
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    const docIds = (docsInDay ?? []).map((d: { id: number }) => d.id)
    let list: any[] = []
    let vehicleIds: number[] = []

    if (docIds.length > 0) {
      const { data: links, error } = await supabase
        .from('document_vehicle_links')
        .select(
          `
          document_id,
          vehicle_id,
          documents (
            id,
            file_name,
            file_path,
            doc_type,
            uploaded_at
          ),
          vehicles (
            id,
            registration,
            vehicle_identifier,
            make,
            model,
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
        list = links
        vehicleIds = Array.from(new Set(list.map((r: any) => r.vehicle_id).filter(Boolean)))
      }
    }

    let routesByVehicle: Record<number, { driver_id: number; route_id: number }[]> = {}
    if (vehicleIds.length > 0) {
      const { data: routes } = await supabase
        .from('routes')
        .select('id, vehicle_id, driver_id')
        .in('vehicle_id', vehicleIds)
      const arr = Array.isArray(routes) ? routes : []
      arr.forEach((r: any) => {
        if (!r.vehicle_id) return
        if (!routesByVehicle[r.vehicle_id]) routesByVehicle[r.vehicle_id] = []
        routesByVehicle[r.vehicle_id].push({ driver_id: r.driver_id, route_id: r.id })
      })
    }

    const driverIds = Array.from(new Set(Object.values(routesByVehicle).flat().map((r) => r.driver_id).filter(Boolean)))
    let employeesByDriver: Record<number, { full_name: string; personal_email: string | null; mobile_phone: string | null }> = {}
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('drivers')
        .select('employee_id, employees(full_name, personal_email, mobile_phone)')
        .in('employee_id', driverIds)
      const arr = Array.isArray(drivers) ? drivers : []
      arr.forEach((d: any) => {
        const emp = Array.isArray(d.employees) ? d.employees[0] : d.employees
        if (d.employee_id && emp) {
          employeesByDriver[d.employee_id] = {
            full_name: emp.full_name ?? '',
            personal_email: emp.personal_email ?? null,
            mobile_phone: emp.mobile_phone ?? null,
          }
        }
      })
    }

    const documents: any[] = []

    // 1) Uploaded documents (document_vehicle_links)
    for (const row of list) {
      const doc = (row as any).documents
      const vehicle = (row as any).vehicles
      if (!doc || !vehicle) continue

      const tolerance = toleranceByKey[doc.doc_type ?? ''] ?? defaultTolerance
      const expiryDate = getVehicleExpiryForDocType(vehicle, doc.doc_type)
      const status = getExpiryStatus(expiryDate, tolerance)
      const daysRemaining = getDaysRemaining(expiryDate)

      if (issuesOnly && status !== 'expiring_soon' && status !== 'expired') continue

      const routeInfo = routesByVehicle[vehicle.id]?.[0]
      const driverId = routeInfo?.driver_id
      const contact = driverId ? employeesByDriver[driverId] : null

      documents.push({
        source: 'document',
        document_id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        doc_type: doc.doc_type,
        created_at: doc.uploaded_at,
        expiry_date: expiryDate,
        status: status ?? 'ok',
        days_remaining: daysRemaining,
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.registration || vehicle.vehicle_identifier || `Vehicle ${vehicle.id}`,
        vehicle_label: [vehicle.registration, vehicle.vehicle_identifier].filter(Boolean).join(' ') || `ID ${vehicle.id}`,
        make: vehicle.make,
        model: vehicle.model,
        assigned_driver_id: driverId ?? null,
        assigned_driver_name: contact?.full_name ?? null,
        contact_email: contact?.personal_email ?? null,
        contact_phone: contact?.mobile_phone ?? null,
      })
    }

    // 2) Dynamic vehicle requirements (subject_documents created on this day or issue_date = this day)
    const { data: subjectByCreated } = await supabase
      .from('subject_documents')
      .select('id, created_at, issue_date, expiry_date, vehicle_id, requirement_id, document_requirements(name, renewal_notice_days)')
      .not('vehicle_id', 'is', null)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
    const { data: subjectByIssue } = await supabase
      .from('subject_documents')
      .select('id, created_at, issue_date, expiry_date, vehicle_id, requirement_id, document_requirements(name, renewal_notice_days)')
      .not('vehicle_id', 'is', null)
      .eq('issue_date', dateStr)
    const seenIds = new Set<string>()
    const subjectList: any[] = []
    for (const r of [...(subjectByCreated || []), ...(subjectByIssue || [])]) {
      if (r.id && !seenIds.has(r.id)) {
        seenIds.add(r.id)
        subjectList.push(r)
      }
    }
    const subjectVehicleIds = Array.from(new Set(subjectList.map((r: any) => r.vehicle_id).filter(Boolean))) as number[]
    const allVehicleIds = Array.from(new Set([...vehicleIds, ...subjectVehicleIds]))
    if (subjectVehicleIds.length > 0) {
      const { data: routes } = await supabase.from('routes').select('id, vehicle_id, driver_id').in('vehicle_id', allVehicleIds)
      const arr = Array.isArray(routes) ? routes : []
      arr.forEach((r: any) => {
        if (!r.vehicle_id) return
        if (!routesByVehicle[r.vehicle_id]) routesByVehicle[r.vehicle_id] = []
        routesByVehicle[r.vehicle_id].push({ driver_id: r.driver_id, route_id: r.id })
      })
      const newDriverIds = Array.from(new Set(arr.map((r: any) => r.driver_id).filter(Boolean)))
      const existingDriverIds = new Set(Object.keys(employeesByDriver).map(Number))
      const toFetch = newDriverIds.filter((id) => !existingDriverIds.has(id))
      if (toFetch.length > 0) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('employee_id, employees(full_name, personal_email, mobile_phone)')
          .in('employee_id', toFetch)
        const drArr = Array.isArray(drivers) ? drivers : []
        drArr.forEach((d: any) => {
          const emp = Array.isArray(d.employees) ? d.employees[0] : d.employees
          if (d.employee_id && emp) {
            employeesByDriver[d.employee_id] = {
              full_name: emp.full_name ?? '',
              personal_email: emp.personal_email ?? null,
              mobile_phone: emp.mobile_phone ?? null,
            }
          }
        })
      }
      const { data: vehiclesForSubject } = await supabase
        .from('vehicles')
        .select('id, registration, vehicle_identifier, make, model')
        .in('id', subjectVehicleIds)
      const vehicleMap: Record<number, any> = {}
      ;(vehiclesForSubject || []).forEach((v: any) => { vehicleMap[v.id] = v })
      for (const row of subjectList) {
        const created = (row as any).created_at
        const issueDate = (row as any).issue_date
        const eventOnDay = created && (new Date(created).toISOString().slice(0, 10) === dateStr) || issueDate === dateStr
        if (!eventOnDay && !issuesOnly) continue
        const expiryDate = (row as any).expiry_date
        const req = (row as any).document_requirements
        const requirementName = req?.name ?? 'Requirement'
        const tolerance = req?.renewal_notice_days != null ? Number(req.renewal_notice_days) : defaultTolerance
        const status = getExpiryStatus(expiryDate, tolerance)
        const daysRemaining = getDaysRemaining(expiryDate)
        if (issuesOnly && status !== 'expiring_soon' && status !== 'expired') continue
        const v = vehicleMap[(row as any).vehicle_id]
        const routeInfo = routesByVehicle[(row as any).vehicle_id]?.[0]
        const driverId = routeInfo?.driver_id
        const contact = driverId ? employeesByDriver[driverId] : null
        documents.push({
          source: 'subject_document',
          subject_document_id: (row as any).id,
          document_id: null,
          file_name: null,
          file_path: null,
          doc_type: requirementName,
          created_at: created,
          expiry_date: expiryDate,
          status: status ?? 'ok',
          days_remaining: daysRemaining,
          vehicle_id: (row as any).vehicle_id,
          vehicle_name: v ? (v.registration || v.vehicle_identifier || `Vehicle ${(row as any).vehicle_id}`) : `Vehicle ${(row as any).vehicle_id}`,
          vehicle_label: v ? [v.registration, v.vehicle_identifier].filter(Boolean).join(' ') || `ID ${(row as any).vehicle_id}` : `ID ${(row as any).vehicle_id}`,
          make: v?.make ?? null,
          model: v?.model ?? null,
          assigned_driver_id: driverId ?? null,
          assigned_driver_name: contact?.full_name ?? null,
          contact_email: contact?.personal_email ?? null,
          contact_phone: contact?.mobile_phone ?? null,
        })
      }
    }

    // 3) Vehicle create fields: certificate expiry dates that fall on this day
    const { data: vehiclesWithExpiry } = await supabase
      .from('vehicles')
      .select('id, registration, vehicle_identifier, make, model, registration_expiry_date, plate_expiry_date, insurance_expiry_date, mot_date, tax_date, loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry')
    const vehicleList = Array.isArray(vehiclesWithExpiry) ? vehiclesWithExpiry : []
    const certificateVehicleIds = vehicleList.filter((v: any) => getVehicleExpiryDates(v).some((e) => e.date === dateStr)).map((v: any) => v.id)
    const allIds = Array.from(new Set([...vehicleIds, ...subjectVehicleIds, ...certificateVehicleIds]))
    if (allIds.length > 0 && allIds.some((id) => !routesByVehicle[id])) {
      const { data: routesExtra } = await supabase.from('routes').select('id, vehicle_id, driver_id').in('vehicle_id', allIds)
      const arr = Array.isArray(routesExtra) ? routesExtra : []
      arr.forEach((r: any) => {
        if (!r.vehicle_id) return
        if (!routesByVehicle[r.vehicle_id]) routesByVehicle[r.vehicle_id] = []
        routesByVehicle[r.vehicle_id].push({ driver_id: r.driver_id, route_id: r.id })
      })
      const allDriverIds = Array.from(new Set(Object.values(routesByVehicle).flat().map((r) => r.driver_id).filter(Boolean)))
      const needFetch = allDriverIds.filter((id) => !employeesByDriver[id])
      if (needFetch.length > 0) {
        const { data: driversExtra } = await supabase
          .from('drivers')
          .select('employee_id, employees(full_name, personal_email, mobile_phone)')
          .in('employee_id', needFetch)
        ;(driversExtra || []).forEach((d: any) => {
          const emp = Array.isArray(d.employees) ? d.employees[0] : d.employees
          if (d.employee_id && emp) {
            employeesByDriver[d.employee_id] = {
              full_name: emp.full_name ?? '',
              personal_email: emp.personal_email ?? null,
              mobile_phone: emp.mobile_phone ?? null,
            }
          }
        })
      }
    }
    for (const vehicle of vehicleList) {
      const expiryEntries = getVehicleExpiryDates(vehicle)
      for (const { key, label, date } of expiryEntries) {
        if (date !== dateStr) continue
        const status = getExpiryStatus(date, defaultTolerance)
        if (issuesOnly && status !== 'expiring_soon' && status !== 'expired') continue
        const daysRemaining = getDaysRemaining(date)
        const routeInfo = routesByVehicle[vehicle.id]?.[0]
        const driverId = routeInfo?.driver_id
        const contact = driverId ? employeesByDriver[driverId] : null
        documents.push({
          source: 'vehicle_certificate',
          document_id: null,
          file_name: null,
          file_path: null,
          doc_type: label,
          created_at: null,
          expiry_date: date,
          status: status ?? 'ok',
          days_remaining: daysRemaining,
          vehicle_id: vehicle.id,
          vehicle_name: vehicle.registration || vehicle.vehicle_identifier || `Vehicle ${vehicle.id}`,
          vehicle_label: [vehicle.registration, vehicle.vehicle_identifier].filter(Boolean).join(' ') || `ID ${vehicle.id}`,
          make: vehicle.make,
          model: vehicle.model,
          assigned_driver_id: driverId ?? null,
          assigned_driver_name: contact?.full_name ?? null,
          contact_email: contact?.personal_email ?? null,
          contact_phone: contact?.mobile_phone ?? null,
        })
      }
    }

    return NextResponse.json({ date: dateStr, documents })
  } catch (err: any) {
    console.error('Calendar day error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
