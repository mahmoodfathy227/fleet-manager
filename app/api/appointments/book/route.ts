import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, slotId, name, email } = body

    if (!token || !slotId) {
      return NextResponse.json({ error: 'token and slotId are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Find notification by email token
    const { data: notification } = await supabase
      .from('notifications')
      .select('*')
      .eq('email_token', token)
      .maybeSingle()

    if (!notification) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    // Check if slot already booked
    const { data: existingBooking } = await supabase
      .from('appointment_bookings')
      .select('id')
      .eq('appointment_slot_id', slotId)
      .maybeSingle()

    if (existingBooking) {
      return NextResponse.json({ error: 'Slot already booked' }, { status: 409 })
    }

    // Build notes from sent appointment link context (certificate + entity)
    let entityName = ''
    if (notification.entity_type === 'vehicle') {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('vehicle_identifier, registration')
        .eq('id', notification.entity_id)
        .single()
      entityName = vehicle?.vehicle_identifier || vehicle?.registration || `Vehicle #${notification.entity_id}`
    } else if (notification.entity_type === 'driver' || notification.entity_type === 'assistant') {
      const { data: employee } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', notification.entity_id)
        .single()
      entityName = employee?.full_name || `${notification.entity_type} #${notification.entity_id}`
    }
    const certName = notification.certificate_name || 'Appointment'
    const bookingNotes = [certName, entityName].filter(Boolean).join(' – ') || 'Booked via appointment link'

    const { data: booking, error: bookingError } = await supabase
      .from('appointment_bookings')
      .insert({
        appointment_slot_id: slotId,
        notification_id: notification.id,
        booked_by_email: email || notification.recipient_email,
        booked_by_name: name || null,
        notes: bookingNotes,
      })
      .select()
      .single()

    if (bookingError) throw bookingError

    // Get slot details for admin summary
    const { data: slot } = await supabase
      .from('appointment_slots')
      .select('slot_start, slot_end')
      .eq('id', slotId)
      .single()

    // Create system activity instead of sending email
    try {
      const slotDate = slot?.slot_start ? new Date(slot.slot_start).toLocaleDateString() : 'N/A'
      const slotTime = slot?.slot_start && slot?.slot_end 
        ? `${new Date(slot.slot_start).toLocaleTimeString()} - ${new Date(slot.slot_end).toLocaleTimeString()}`
        : 'N/A'

      const { data: activity, error: activityError } = await supabase
        .from('system_activities')
        .insert({
          activity_type: 'appointment_booking',
          notification_id: notification.id,
          entity_type: notification.entity_type,
          entity_id: notification.entity_id,
          entity_name: entityName,
          certificate_name: notification.certificate_name,
          recipient_name: name || null,
          recipient_email: email || notification.recipient_email || null,
          details: {
            appointmentDate: slotDate,
            appointmentTime: slotTime,
            slotStart: slot?.slot_start || null,
            slotEnd: slot?.slot_end || null,
          },
        })
        .select()
        .single()

      if (activityError) {
        console.error('Failed to create system activity:', activityError)
        // Don't fail the booking if activity creation fails
      }

      // Update the original notification to track employee response
      const { error: updateNotifError } = await supabase
        .from('notifications')
        .update({
          employee_response_type: 'appointment_booked',
          employee_response_details: {
            appointmentDate: slotDate,
            appointmentTime: slotTime,
            slotStart: slot?.slot_start || null,
            slotEnd: slot?.slot_end || null,
          },
          employee_response_received_at: new Date().toISOString(),
          admin_response_required: true, // Flag for admin to review
          status: 'sent', // Keep status as 'sent' but mark as requiring admin response
        })
        .eq('id', notification.id)

      if (updateNotifError) {
        console.error('Failed to update notification with employee response:', updateNotifError)
        // Don't fail the booking if notification update fails
      }
    } catch (summaryError) {
      console.error('Failed to create system activity:', summaryError)
      // Don't fail the booking if activity creation fails
    }

    return NextResponse.json({ success: true, booking })
  } catch (error: any) {
    console.error('Error booking appointment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to book appointment' },
      { status: 500 }
    )
  }
}

