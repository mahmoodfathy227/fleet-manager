import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface SummaryData {
  type: 'document_upload' | 'appointment_booking'
  notificationId: number
  recipientName?: string
  recipientEmail?: string
  entityType: string
  entityName: string
  certificateName: string
  details?: {
    filesUploaded?: number
    fileNames?: string[]
    uploadedFileUrls?: string[]
    appointmentSlot?: string
    appointmentDate?: string
    appointmentTime?: string
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const summaryData: SummaryData = body

    const supabase = await createClient()

    // Get notification details for context
    const { data: notification } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', summaryData.notificationId)
      .single()

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Create system activity record instead of sending email
    const activityData: any = {
      activity_type: summaryData.type,
      notification_id: summaryData.notificationId,
      entity_type: summaryData.entityType,
      entity_id: notification.entity_id,
      entity_name: summaryData.entityName,
      certificate_name: summaryData.certificateName,
      recipient_name: summaryData.recipientName || null,
      recipient_email: summaryData.recipientEmail || notification.recipient_email || null,
      details: summaryData.details || {},
    }

    const { data: activity, error: activityError } = await supabase
      .from('system_activities')
      .insert(activityData)
      .select()
      .single()

    if (activityError) {
      console.error('Error creating system activity:', activityError)
      return NextResponse.json(
        { error: 'Failed to create system activity', details: activityError.message },
        { status: 500 }
      )
    }

    // Update the original notification to track employee response
    let responseType = 'document_uploaded'
    if (summaryData.type === 'appointment_booking') {
      responseType = 'appointment_booked'
    }

    const { error: updateNotifError } = await supabase
      .from('notifications')
      .update({
        employee_response_type: responseType,
        employee_response_details: summaryData.details || {},
        employee_response_received_at: new Date().toISOString(),
        admin_response_required: true, // Flag for admin to review
        status: 'sent', // Keep status as 'sent' but mark as requiring admin response
      })
      .eq('id', summaryData.notificationId)

    if (updateNotifError) {
      console.error('Error updating notification with employee response:', updateNotifError)
      // Don't fail if notification update fails
    }

    return NextResponse.json({ 
      success: true, 
      message: 'System activity and admin notification created',
      activity 
    })
  } catch (error: any) {
    console.error('Error creating system activity:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create system activity' },
      { status: 500 }
    )
  }
}

