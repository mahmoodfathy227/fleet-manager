import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fillTR7Report, TR7FormData } from '@/lib/utils/tr7Export'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const incidentId = parseInt(id)

    if (isNaN(incidentId)) {
      return NextResponse.json(
        { error: 'Invalid incident ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch incident with all related data
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select(`
        *,
        vehicles(id, vehicle_identifier, registration, plate_number),
        routes(id, route_number),
        route_sessions(
          id,
          session_date,
          session_type,
          driver_id,
          passenger_assistant_id
        )
      `)
      .eq('id', incidentId)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }

    // Fetch related employees
    const { data: relatedEmployees } = await supabase
      .from('incident_employees')
      .select('*, employees(id, full_name, role)')
      .eq('incident_id', incidentId)

    // Fetch related passengers
    const { data: relatedPassengers } = await supabase
      .from('incident_passengers')
      .select('*, passengers(id, full_name, schools(name))')
      .eq('incident_id', incidentId)

    // Get driver and PA info
    let driverInfo = null
    let paInfo = null

    const routeSessions = incident.route_sessions
    if (routeSessions) {
      const session = Array.isArray(routeSessions) ? routeSessions[0] : routeSessions

      if (session.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('tas_badge_number, employees(full_name)')
          .eq('employee_id', session.driver_id)
          .maybeSingle()

        if (driverData) {
          driverInfo = {
            name: (driverData.employees as any)?.full_name || null,
            tasNumber: driverData.tas_badge_number || null,
          }
        }
      }

      if (session.passenger_assistant_id) {
        const { data: paData } = await supabase
          .from('passenger_assistants')
          .select('tas_badge_number, employees(full_name)')
          .eq('employee_id', session.passenger_assistant_id)
          .maybeSingle()

        if (paData) {
          paInfo = {
            name: (paData.employees as any)?.full_name || null,
            tasNumber: paData.tas_badge_number || null,
          }
        }
      }
    }

    // Try from incident employees if still missing
    if ((!driverInfo || !paInfo) && relatedEmployees) {
      for (const emp of relatedEmployees) {
        if (emp.employees?.role === 'Driver' && !driverInfo) {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('tas_badge_number')
            .eq('employee_id', emp.employees.id)
            .maybeSingle()

          if (driverData) {
            driverInfo = {
              name: emp.employees.full_name,
              tasNumber: driverData.tas_badge_number || null,
            }
          }
        } else if (emp.employees?.role === 'PA' && !paInfo) {
          const { data: paData } = await supabase
            .from('passenger_assistants')
            .select('tas_badge_number')
            .eq('employee_id', emp.employees.id)
            .maybeSingle()

          if (paData) {
            paInfo = {
              name: emp.employees.full_name,
              tasNumber: paData.tas_badge_number || null,
            }
          }
        }
      }
    }

    // Format dates and times
    const formatDate = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const formatTime = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toTimeString().slice(0, 5)
    }

    const formatDateTime = (dateString: string) => {
      if (!dateString) return ''
      return `${formatDate(dateString)} ${formatTime(dateString)}`
    }

    // Check for saved TR7 form data
    const { data: savedForm } = await supabase
      .from('documents')
      .select('file_url')
      .eq('owner_type', 'incident')
      .eq('owner_id', incidentId)
      .eq('doc_type', 'TR7 Form')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let savedFormData: any = {}
    if (savedForm?.file_url) {
      try {
        savedFormData = typeof savedForm.file_url === 'string'
          ? JSON.parse(savedForm.file_url)
          : savedForm.file_url
      } catch (e) {
        console.warn('Could not parse saved TR7 form data:', e)
      }
    }

    // Prepare passenger data for TR7
    const passengerNames = relatedPassengers?.map((ip: any) => ip.passengers?.full_name).filter(Boolean).join(', ') || ''
    const passengerAges = relatedPassengers?.map((ip: any) => {
      // Try to get age if available, otherwise leave empty
      return ''
    }).filter(Boolean).join(', ') || ''
    const passengerEthnicity = relatedPassengers?.map((ip: any) => {
      // Try to get ethnicity if available, otherwise leave empty
      return ''
    }).filter(Boolean).join(', ') || ''
    const schoolName = relatedPassengers?.[0]?.passengers?.schools?.name || ''

    // Prepare TR7 form data
    const tr7Data: TR7FormData = {
      incident_date: savedFormData.incident_date || formatDate(incident.reported_at),
      incident_time: savedFormData.incident_time || formatTime(incident.reported_at),
      school_name: savedFormData.school_name || schoolName,
      passenger_names: savedFormData.passenger_names || passengerNames,
      passenger_ages: savedFormData.passenger_ages || passengerAges,
      passenger_ethnicity: savedFormData.passenger_ethnicity || passengerEthnicity,
      operator_name: savedFormData.operator_name || '',
      vehicle_number: savedFormData.vehicle_number || incident.vehicles?.vehicle_identifier || incident.vehicles?.registration || '',
      exit_location: savedFormData.exit_location || incident.location || '',
      distance_from_destination: savedFormData.distance_from_destination || '',
      prior_incidents: savedFormData.prior_incidents || '',
      passenger_comments: savedFormData.passenger_comments || '',
      distinguishing_features: savedFormData.distinguishing_features || '',
      clothing_description: savedFormData.clothing_description || '',
      school_uniform_details: savedFormData.school_uniform_details || '',
      tas_staff_name: savedFormData.tas_staff_name || paInfo?.name || driverInfo?.name || '',
      tas_report_time: savedFormData.tas_report_time || formatDateTime(incident.reported_at),
      police_reference_number: savedFormData.police_reference_number || '',
      form_completed_by: savedFormData.form_completed_by || '',
      signature_name: savedFormData.signature_name || '',
      signature_date: savedFormData.signature_date || formatDate(new Date().toISOString()),
    }

    // Generate the filled document
    const buffer = await fillTR7Report(tr7Data)

    // Create filename
    const safeRouteNumber = (incident.routes?.route_number || `Incident_${incidentId}`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `TR7_${safeRouteNumber}_${dateStr}.docx`

    // Return the file
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('Error generating TR7:', error)
    return NextResponse.json(
      { error: `Failed to generate TR7 form: ${error.message}` },
      { status: 500 }
    )
  }
}

