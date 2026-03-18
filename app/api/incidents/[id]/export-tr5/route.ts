import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fillIncidentReport, TR5FormData } from '@/lib/utils/tr5Export'

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
      .select('*, passengers(id, full_name)')
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

    // Try to get from route if not in session
    if ((!driverInfo || !paInfo) && incident.routes) {
      const { data: routeData } = await supabase
        .from('routes')
        .select(`
          driver_id,
          passenger_assistant_id,
          driver:driver_id(drivers(tas_badge_number), employees(full_name)),
          pa:passenger_assistant_id(passenger_assistants(tas_badge_number), employees(full_name))
        `)
        .eq('id', incident.routes.id)
        .maybeSingle()

      if (routeData) {
        if (routeData.driver && !driverInfo) {
          const driver = routeData.driver as any
          driverInfo = {
            name: driver.employees?.full_name || null,
            tasNumber: driver.drivers?.tas_badge_number || null,
          }
        }
        if (routeData.pa && !paInfo) {
          const pa = routeData.pa as any
          paInfo = {
            name: pa.employees?.full_name || null,
            tasNumber: pa.passenger_assistants?.tas_badge_number || null,
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

    // Format dates
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

    // Check for saved TR5 form data
    const { data: savedForm } = await supabase
      .from('documents')
      .select('file_url')
      .eq('owner_type', 'incident')
      .eq('owner_id', incidentId)
      .eq('doc_type', 'TR5 Form')
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
        console.warn('Could not parse saved form data:', e)
      }
    }

    // Prepare TR5 form data
    const tr5Data: TR5FormData = {
      incident_date: savedFormData.dateOfIncident || formatDate(incident.reported_at),
      incident_time: savedFormData.timeOfIncident || formatTime(incident.reported_at),
      form_completed_date: savedFormData.dateFormCompleted || formatDate(new Date().toISOString()),
      fps_number: incident.routes?.route_number || '',
      operator_name: savedFormData.operator || '',
      establishment_name: savedFormData.establishment || '',
      driver_name: driverInfo?.name || savedFormData.driverName || '',
      driver_tas_number: driverInfo?.tasNumber || savedFormData.driverTASNumber || '',
      vehicle_registration: incident.vehicles?.registration || incident.vehicles?.plate_number || incident.vehicles?.vehicle_identifier || savedFormData.vehicleReg || '',
      pa_names: paInfo?.name || savedFormData.paName || '',
      pa_tas_numbers: paInfo?.tasNumber || savedFormData.paTASNumber || '',
      passengers_involved: relatedPassengers?.map((ip: any) => ip.passengers?.full_name).filter(Boolean).join(', ') || savedFormData.passengersInvolved || '',
      description: savedFormData.description || incident.description || '',
      photos_attached: savedFormData.photosAttached ? 'Yes' : 'No',
      report_completed_by: savedFormData.personCompletingForm || '',
      reporter_signature: savedFormData.personCompletingForm || '',
      reporter_signature_date: savedFormData.dateFormCompleted || formatDate(new Date().toISOString()),
      witnessed_incident: savedFormData.witnessName ? 'Yes' : 'No',
      witness_signature_1: savedFormData.witnessName || '',
      // Additional fields from TR5 form guidance
      incident_triggers: savedFormData.incidentTriggers || '',
      previous_incidents: savedFormData.previousIncidents || '',
      prevention_actions: savedFormData.preventionActions || '',
      actions_during_incident: savedFormData.actionsDuringIncident || '',
      incident_outcome: savedFormData.incidentOutcome || '',
      reported_to: savedFormData.reportedTo || '',
      who_was_informed: savedFormData.whoWasInformed || '',
      staff_suggestions: savedFormData.staffSuggestions || '',
    }

    // Generate the filled document
    const buffer = await fillIncidentReport(tr5Data)

    // Create filename
    const safeRouteNumber = (incident.routes?.route_number || `Incident_${incidentId}`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `TR5_${safeRouteNumber}_${dateStr}.docx`

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
    console.error('Error generating TR5:', error)
    return NextResponse.json(
      { error: `Failed to generate TR5 form: ${error.message}` },
      { status: 500 }
    )
  }
}

