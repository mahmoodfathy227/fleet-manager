import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fillTR6Report, TR6FormData } from '@/lib/utils/tr6Export'

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
        routes(id, route_number)
      `)
      .eq('id', incidentId)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }

    // Format dates and times
    const formatDateTime = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const timeStr = date.toTimeString().slice(0, 5)
      return `${dateStr} ${timeStr}`
    }

    // Check for saved TR6 form data
    const { data: savedForm } = await supabase
      .from('documents')
      .select('file_url')
      .eq('owner_type', 'incident')
      .eq('owner_id', incidentId)
      .eq('doc_type', 'TR6 Form')
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
        console.warn('Could not parse saved TR6 form data:', e)
      }
    }

    // Prepare TR6 form data
    const tr6Data: TR6FormData = {
      other_driver_name: savedFormData.other_driver_name || '',
      is_registered_owner: savedFormData.is_registered_owner || '',
      vehicle_owner_name: savedFormData.vehicle_owner_name || '',
      insurance_company: savedFormData.insurance_company || '',
      insurance_policy_number: savedFormData.insurance_policy_number || '',
      other_vehicle_make: savedFormData.other_vehicle_make || '',
      other_vehicle_colour: savedFormData.other_vehicle_colour || '',
      other_vehicle_registration: savedFormData.other_vehicle_registration || '',
      damage_description: savedFormData.damage_description || incident.description || '',
      accident_location: savedFormData.accident_location || incident.location || '',
      accident_datetime: savedFormData.accident_datetime || formatDateTime(incident.reported_at),
      witness_names: savedFormData.witness_names || '',
      witness_address: savedFormData.witness_address || '',
      other_driver_comments: savedFormData.other_driver_comments || '',
    }

    // Generate the filled document
    const buffer = await fillTR6Report(tr6Data)

    // Create filename
    const safeRouteNumber = (incident.routes?.route_number || `Incident_${incidentId}`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `TR6_${safeRouteNumber}_${dateStr}.docx`

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
    console.error('Error generating TR6:', error)
    return NextResponse.json(
      { error: `Failed to generate TR6 form: ${error.message}` },
      { status: 500 }
    )
  }
}

