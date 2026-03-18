import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get field audit history for this vehicle
    const { data, error } = await supabase
      .from('field_audit_log')
      .select(`
        id,
        field_name,
        old_value,
        new_value,
        change_time,
        action,
        changed_by,
        users (
          email,
          employees (
            full_name
          )
        )
      `)
      .eq('table_name', 'vehicles')
      .eq('record_id', id)
      .order('change_time', { ascending: false })

    if (error) throw error

    // Group by field_name and get the most recent change for each field
    const fieldHistory: Record<string, any> = {}
    
    if (data) {
      data.forEach((log: any) => {
        const fieldName = log.field_name
        // Only keep the most recent change for each field
        if (!fieldHistory[fieldName] || new Date(log.change_time) > new Date(fieldHistory[fieldName].change_time)) {
          fieldHistory[fieldName] = {
            field_name: fieldName,
            change_time: log.change_time,
            action: log.action,
            changed_by: log.users?.email || 'Unknown',
            changed_by_name: log.users?.employees?.full_name || log.users?.email || 'Unknown',
          }
        }
      })
    }

    return NextResponse.json({ fieldHistory })
  } catch (error: any) {
    console.error('Error fetching field audit:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch field audit' },
      { status: 500 }
    )
  }
}

