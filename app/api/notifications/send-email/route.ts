import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      notificationId,
      subject,
      emailBody,
      hold = true,
      includeAppointmentLink = true,
      recipientEmail, // Optional: custom recipient email
    } = body

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    const actingUserId = userRow?.id ?? null

    // Get notification details
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single()

    if (notifError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Use custom recipient email if provided, otherwise use notification's default
    const finalRecipientEmail = recipientEmail || notification.recipient_email
    
    if (!finalRecipientEmail) {
      return NextResponse.json({ error: 'No recipient email address' }, { status: 400 })
    }

    // Get recipient employee name for greeting
    // Try to find employee by email first
    let recipientName = finalRecipientEmail.split('@')[0]
    const { data: recipientEmployeeByEmail } = await supabase
      .from('employees')
      .select('full_name, id')
      .eq('personal_email', finalRecipientEmail)
      .maybeSingle()
    
    if (recipientEmployeeByEmail?.full_name) {
      recipientName = recipientEmployeeByEmail.full_name
    } else if (notification.recipient_employee_id) {
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
      
      // Map certificate types to document names
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

    // Generate links (use request origin if available, fallback to environment or domain)
    const requestOrigin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/')
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      requestOrigin ||
      'https://senfleetmanager.com'
    const uploadLink = `${baseUrl}/upload-document/${notification.email_token}`
    const appointmentLink = `${baseUrl}/book-appointment/${notification.email_token}`

    // Use provided subject/body or generate default
    let finalSubject = subject
    let finalBody = emailBody

    if (!finalSubject || !finalBody) {
      // Generate default email content
      const expiryStatus = notification.days_until_expiry < 0 
        ? 'EXPIRED' 
        : notification.days_until_expiry <= 7 
          ? 'EXPIRING SOON' 
          : 'Expiring Soon'
      
      finalSubject = finalSubject || `[${expiryStatus}] ${notification.certificate_name} - ${entityName}`

      finalBody = finalBody || `Dear ${recipientName},

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

${includeAppointmentLink ? `**Book an Appointment (optional):**
If you need assistance, you can book an appointment using this link:
${appointmentLink}` : ''}

This link is unique and secure. Please do not share it with others.

If you have any questions, please contact the fleet management office.

Best regards,
Fleet Management System`
    } else {
      // If custom body is provided, append appointment link if requested
      if (includeAppointmentLink && !finalBody.includes(appointmentLink)) {
        finalBody += `\n\n**Book an Appointment (optional):**
If you need assistance, you can book an appointment using this link:
${appointmentLink}`
      }
    }

    // TODO: Integrate with your email service (Resend, SendGrid, etc.)
    // SMTP send (HTML + text)
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM || smtpUser

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.warn('SMTP not fully configured; skipping send. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM')
    } else {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })

      // Convert to HTML with proper link formatting
      let htmlBody = finalBody
        // Convert markdown-style links to HTML links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>')
        // Convert plain URLs to clickable links
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color: #2563eb; text-decoration: underline;">$1</a>')
        // Convert line breaks
        .replace(/\n/g, '<br>')
        // Convert markdown bold to HTML bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

      await transporter.sendMail({
        from: smtpFrom,
        to: finalRecipientEmail, // Use the selected recipient email
        subject: finalSubject,
        text: finalBody,
        html: htmlBody,
      })
    }

    // Update notification status
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        status: 'sent',
        email_sent_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    if (updateError) throw updateError

    // Apply holds if requested
    if (hold) {
      const holdReason =
        'Auto hold after compliance email sent - awaiting documents/appointment'
      const holdPayload = {
        on_hold: true,
        on_hold_reason: holdReason,
        on_hold_notification_id: notificationId,
        on_hold_set_by: actingUserId,
        on_hold_set_at: new Date().toISOString(),
        on_hold_cleared_at: null,
      }

      // Apply holds serially to avoid TS issues with builders
      if (notification.entity_type === 'vehicle') {
        await supabase.from('vehicles').update(holdPayload).eq('id', notification.entity_id)
        await supabase
          .from('routes')
          .update(holdPayload)
          .eq('vehicle_id', notification.entity_id)
      } else if (notification.entity_type === 'driver') {
        await supabase
          .from('drivers')
          .update(holdPayload)
          .eq('employee_id', notification.entity_id)
        await supabase
          .from('routes')
          .update(holdPayload)
          .eq('driver_id', notification.entity_id)
        const { data: routeVehicles } = await supabase
          .from('routes')
          .select('vehicle_id')
          .eq('driver_id', notification.entity_id)
          .not('vehicle_id', 'is', null)
        const vehicleIds =
          routeVehicles?.map((r: any) => r.vehicle_id).filter(Boolean) || []
        if (vehicleIds.length > 0) {
          await supabase.from('vehicles').update(holdPayload).in('id', vehicleIds)
        }
      } else if (notification.entity_type === 'assistant') {
        await supabase
          .from('passenger_assistants')
          .update(holdPayload)
          .eq('employee_id', notification.entity_id)
        await supabase
          .from('routes')
          .update(holdPayload)
          .eq('passenger_assistant_id', notification.entity_id)
        const { data: routeVehicles } = await supabase
          .from('routes')
          .select('vehicle_id')
          .eq('passenger_assistant_id', notification.entity_id)
          .not('vehicle_id', 'is', null)
        const vehicleIds =
          routeVehicles?.map((r: any) => r.vehicle_id).filter(Boolean) || []
        if (vehicleIds.length > 0) {
          await supabase.from('vehicles').update(holdPayload).in('id', vehicleIds)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      // In development, return the email content for testing
      ...(process.env.NODE_ENV === 'development' && {
        emailContent: {
          to: finalRecipientEmail,
          subject: finalSubject,
          body: finalBody,
          uploadLink,
          ...(includeAppointmentLink ? { appointmentLink } : {}),
        }
      })
    })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

