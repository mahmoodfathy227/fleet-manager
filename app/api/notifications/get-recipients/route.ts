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

    const recipients: Array<{ email: string; name: string; type: string }> = []

    if (notification.entity_type === 'vehicle') {
      // Get assigned employee (current default recipient)
      if (notification.recipient_employee_id && notification.recipient_email) {
        const { data: assignedEmployee } = await supabase
          .from('employees')
          .select('full_name, personal_email')
          .eq('id', notification.recipient_employee_id)
          .single()
        
        if (assignedEmployee?.personal_email) {
          recipients.push({
            email: assignedEmployee.personal_email,
            name: assignedEmployee.full_name || 'Assigned Employee',
            type: 'assigned_employee'
          })
        }
      }

      // Get drivers and PAs from routes assigned to this vehicle
      const { data: routes } = await supabase
        .from('routes')
        .select(`
          driver_id,
          passenger_assistant_id,
          driver:driver_id(employees(full_name, personal_email)),
          pa:passenger_assistant_id(employees(full_name, personal_email))
        `)
        .eq('vehicle_id', notification.entity_id)
        .limit(20)

      if (routes) {
        const driverEmails = new Set<string>()
        const paEmails = new Set<string>()
        
        routes.forEach((route: any) => {
          // Process driver
          if (route.driver_id) {
            const driver = Array.isArray(route.driver) ? route.driver[0] : route.driver
            const driverEmp = Array.isArray(driver?.employees) ? driver.employees[0] : driver?.employees
            if (driverEmp?.personal_email && !driverEmails.has(driverEmp.personal_email)) {
              driverEmails.add(driverEmp.personal_email)
              recipients.push({
                email: driverEmp.personal_email,
                name: driverEmp.full_name || 'Driver',
                type: 'driver'
              })
            }
          }
          
          // Process passenger assistant
          if (route.passenger_assistant_id) {
            const pa = Array.isArray(route.pa) ? route.pa[0] : route.pa
            const paEmp = Array.isArray(pa?.employees) ? pa.employees[0] : pa?.employees
            if (paEmp?.personal_email && !paEmails.has(paEmp.personal_email)) {
              paEmails.add(paEmp.personal_email)
              recipients.push({
                email: paEmp.personal_email,
                name: paEmp.full_name || 'Passenger Assistant',
                type: 'passenger_assistant'
              })
            }
          }
        })
      }
    } else if (notification.entity_type === 'driver') {
      // For driver notifications, the driver themselves is the recipient
      if (notification.recipient_email) {
        const { data: driverEmployee } = await supabase
          .from('employees')
          .select('full_name, personal_email')
          .eq('id', notification.entity_id)
          .single()

        recipients.push({
          email: notification.recipient_email,
          name: driverEmployee?.full_name || 'Driver',
          type: 'driver'
        })
      }
    } else if (notification.entity_type === 'assistant') {
      // For assistant notifications, the assistant themselves is the recipient
      if (notification.recipient_email) {
        const { data: assistantEmployee } = await supabase
          .from('employees')
          .select('full_name, personal_email')
          .eq('id', notification.entity_id)
          .single()

        recipients.push({
          email: notification.recipient_email,
          name: assistantEmployee?.full_name || 'Passenger Assistant',
          type: 'passenger_assistant'
        })
      }
    }

    return NextResponse.json({ recipients })
  } catch (error: any) {
    console.error('Error fetching recipients:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recipients' },
      { status: 500 }
    )
  }
}

