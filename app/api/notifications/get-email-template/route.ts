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

    // Get notification details
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single()

    if (notifError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (!notification.recipient_email) {
      return NextResponse.json({ error: 'No recipient email address' }, { status: 400 })
    }

    // Get recipient employee name for greeting
    let recipientName = notification.recipient_email.split('@')[0]
    if (notification.recipient_employee_id) {
      const { data: recipientEmployee } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', notification.recipient_employee_id)
        .single()
      if (recipientEmployee?.full_name) {
        recipientName = recipientEmployee.full_name
      }
    }

    // Get entity details for email content
    let entityName = ''
    let entityLink = ''
    let neededDocuments: string[] = []

    if (notification.entity_type === 'vehicle') {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('vehicle_identifier, registration')
        .eq('id', notification.entity_id)
        .single()
      entityName = vehicle?.vehicle_identifier || vehicle?.registration || `Vehicle #${notification.entity_id}`
      entityLink = `/dashboard/vehicles/${notification.entity_id}`
      
      const certDocMap: Record<string, string> = {
        'registration_expiry_date': 'Vehicle Plate Certificate',
        'plate_expiry_date': 'Vehicle Registration/Plate Certificate',
        'insurance_expiry_date': 'Vehicle Insurance Certificate',
        'mot_date': 'MOT Certificate',
        'tax_date': 'Vehicle Tax Certificate',
        'loler_expiry_date': 'LOLER Certificate',
        'first_aid_expiry': 'First Aid Kit Certificate',
        'fire_extinguisher_expiry': 'Fire Extinguisher Certificate'
      }
      neededDocuments = [certDocMap[notification.certificate_type] || notification.certificate_name]
    } else if (notification.entity_type === 'driver') {
      const { data: employee } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', notification.entity_id)
        .single()
      entityName = employee?.full_name || `Driver #${notification.entity_id}`
      entityLink = `/dashboard/employees/${notification.entity_id}`
      
      const certDocMap: Record<string, string> = {
        'tas_badge_expiry_date': 'TAS Badge Certificate',
        'taxi_badge_expiry_date': 'Taxi Badge Certificate',
        'dbs_expiry_date': 'DBS Certificate',
        'first_aid_certificate_expiry_date': 'First Aid Certificate',
        'driving_license_expiry_date': 'Driving License'
      }
      neededDocuments = [certDocMap[notification.certificate_type] || notification.certificate_name]
    } else if (notification.entity_type === 'assistant') {
      const { data: employee } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', notification.entity_id)
        .single()
      entityName = employee?.full_name || `Assistant #${notification.entity_id}`
      entityLink = `/dashboard/employees/${notification.entity_id}`
      
      const certDocMap: Record<string, string> = {
        'tas_badge_expiry_date': 'TAS Badge Certificate',
        'dbs_expiry_date': 'DBS Certificate'
      }
      neededDocuments = [certDocMap[notification.certificate_type] || notification.certificate_name]
    }

    // Generate upload link with proper base URL (use request origin if available)
    const requestOrigin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      requestOrigin ||
      'https://senfleetmanager.com'
    const uploadLink = `${baseUrl}/upload-document/${notification.email_token}`
    const appointmentLink = `${baseUrl}/book-appointment/${notification.email_token}`

    // Email subject
    const expiryStatus = notification.days_until_expiry < 0 
      ? 'EXPIRED' 
      : notification.days_until_expiry <= 7 
        ? 'EXPIRING SOON' 
        : 'Expiring Soon'
    
    const subject = `[${expiryStatus}] ${notification.certificate_name} - ${entityName}`

    // Email body with placeholders
    const emailBody = `Dear ${recipientName},

This is an automated notification regarding compliance certificate expiry.

**Certificate Details:**
- Certificate: ${notification.certificate_name}
- Entity: ${entityName}
- Expiry Date: ${new Date(notification.expiry_date).toLocaleDateString()}
- Status: ${notification.days_until_expiry < 0 
  ? `EXPIRED ${Math.abs(notification.days_until_expiry)} days ago` 
  : `Expires in ${notification.days_until_expiry} days`}

**Required Documents:**
${neededDocuments.map(doc => `- ${doc}`).join('\n')}

**Action Required:**
Please upload the required documents using the secure link below. You can scan documents directly using your device camera.

Upload Link: ${uploadLink}

**Book an Appointment (optional):**
If you need assistance, you can book an appointment using this link:
${appointmentLink}

This link is unique and secure. Please do not share it with others.

If you have any questions, please contact the fleet management office.

Best regards,
Fleet Management System`

    return NextResponse.json({ 
      success: true,
      subject,
      body: emailBody,
      emailTemplate: {
        to: notification.recipient_email,
        subject,
        body: emailBody,
        uploadLink,
        appointmentLink
      }
    })
  } catch (error: any) {
    console.error('Error getting email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get email template' },
      { status: 500 }
    )
  }
}

