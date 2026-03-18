import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { driverId, routeId, routeSessionId: providedRouteSessionId, sessionType, reason, additionalNotes } = body

    if (!driverId || !sessionType || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: driverId, sessionType, and reason are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Use provided routeSessionId if available, otherwise try to find existing route session for today
    let routeSessionId: number | null = providedRouteSessionId || null
    if (!routeSessionId && routeId) {
      const { data: sessionData } = await supabase
        .from('route_sessions')
        .select('id')
        .eq('route_id', routeId)
        .eq('session_date', today)
        .eq('session_type', sessionType)
        .maybeSingle()

      routeSessionId = sessionData?.id || null
    }

    // Insert tardiness report
    const { data: tardinessReport, error: insertError } = await supabase
      .from('tardiness_reports')
      .insert({
        driver_id: driverId,
        route_id: routeId || null,
        route_session_id: routeSessionId,
        session_type: sessionType,
        session_date: today,
        reason: reason,
        additional_notes: additionalNotes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting tardiness report:', insertError)
      return NextResponse.json(
        { error: 'Failed to create tardiness report: ' + insertError.message },
        { status: 500 }
      )
    }

    // Create notification for coordinators using the database function
    const { data: notificationData, error: notificationError } = await supabase.rpc(
      'create_tardiness_notification',
      {
        p_tardiness_report_id: tardinessReport.id,
        p_driver_id: driverId,
        p_route_id: routeId || null,
        p_reason: reason,
      }
    )

    if (notificationError) {
      console.error('Error creating notification:', notificationError)
      // Don't fail the request if notification creation fails, but log it
    }

    return NextResponse.json({
      success: true,
      tardinessReportId: tardinessReport.id,
      message: 'Tardiness report submitted successfully',
    })
  } catch (error: any) {
    console.error('Error reporting tardiness:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to report tardiness' },
      { status: 500 }
    )
  }
}

