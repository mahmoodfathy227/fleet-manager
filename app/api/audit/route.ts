import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { table_name, record_id, action } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user's ID from the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching user:', userError)
      // Continue without audit log if user lookup fails
      return NextResponse.json({ success: true, warning: 'Audit log skipped: user not found' })
    }

    if (!userData) {
      // User not found in users table, skip audit log
      return NextResponse.json({ success: true, warning: 'Audit log skipped: user not found' })
    }

    // Insert audit log
    const { error } = await supabase.from('audit_log').insert({
      table_name,
      record_id,
      action,
      changed_by: userData.id,
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Audit log error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to log audit' },
      { status: 500 }
    )
  }
}

