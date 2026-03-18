import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tardinessReportId, coordinatorNotes } = body

    if (!tardinessReportId) {
      return NextResponse.json(
        { error: 'Missing required field: tardinessReportId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to find employee by personal_email first
    let employeeData: any = null
    const { data: employeeByEmail } = await supabase
      .from('employees')
      .select('id, role, personal_email')
      .eq('personal_email', user.email)
      .maybeSingle()

    if (employeeByEmail) {
      employeeData = employeeByEmail
    } else {
      // Fallback: Try to find through users table
      const { data: userData } = await supabase
        .from('users')
        .select('employee_id')
        .eq('email', user.email)
        .maybeSingle()

      if (userData?.employee_id) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, role')
          .eq('id', userData.employee_id)
          .maybeSingle()
        
        if (empData) {
          employeeData = empData
        }
      }
    }

    // If employee not found, allow decline but set coordinator_id to null (system)
    // Check role only if employee was found
    if (employeeData && employeeData.role !== 'Coordinator') {
      return NextResponse.json(
        { error: 'Only coordinators can decline tardiness reports' },
        { status: 403 }
      )
    }

    // Update tardiness report
    // If employee not found, coordinator_id will be null (system decline)
    const { error: updateError } = await supabase
      .from('tardiness_reports')
      .update({
        status: 'declined',
        coordinator_id: employeeData?.id || null,
        coordinator_notes: coordinatorNotes || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tardinessReportId)
      .eq('status', 'pending') // Only update if still pending

    if (updateError) {
      console.error('Error declining tardiness report:', updateError)
      return NextResponse.json(
        { error: 'Failed to decline tardiness report: ' + updateError.message },
        { status: 500 }
      )
    }

    // Update notification status to resolved
    const { data: notificationData } = await supabase
      .from('notifications')
      .select('id')
      .eq('notification_type', 'driver_tardiness')
      .eq('certificate_type', tardinessReportId.toString())
      .eq('status', 'pending')
      .maybeSingle()

    if (notificationData) {
      await supabase
        .from('notifications')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', notificationData.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Tardiness report declined successfully',
    })
  } catch (error: any) {
    console.error('Error declining tardiness:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to decline tardiness report' },
      { status: 500 }
    )
  }
}

