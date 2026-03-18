import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { notificationId } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get notification details to check if it's a breakdown notification
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('notification_type, details')
      .eq('id', notificationId)
      .single()

    if (notifError) throw notifError

    // Update notification status
    const { error } = await supabase
      .from('notifications')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        admin_response_required: false // Clear the flag when resolved
      })
      .eq('id', notificationId)

    if (error) throw error

    // If this is a breakdown notification, also update the breakdown status
    if (notification?.notification_type === 'vehicle_breakdown' && notification?.details?.breakdown_id) {
      const breakdownId = notification.details.breakdown_id
      
      const { error: breakdownError } = await supabase
        .from('vehicle_breakdowns')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', breakdownId)

      if (breakdownError) {
        console.error('Error updating breakdown status:', breakdownError)
        // Don't fail the whole request if breakdown update fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error resolving notification:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve notification' },
      { status: 500 }
    )
  }
}

