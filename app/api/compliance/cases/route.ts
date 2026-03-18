import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { notification_id: notificationId } = body

    if (!notificationId || typeof notificationId !== 'number') {
      return NextResponse.json(
        { error: 'notification_id is required and must be a number' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('compliance_cases')
      .select('id')
      .eq('notification_id', notificationId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ case_id: existing.id, existing: true })
    }

    const { data: caseRow, error } = await supabase
      .from('compliance_cases')
      .insert({
        notification_id: notificationId,
        application_status: 'not_applied',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating compliance case:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create compliance case' },
        { status: 500 }
      )
    }

    return NextResponse.json({ case_id: caseRow.id })
  } catch (err: any) {
    console.error('Compliance case create error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
