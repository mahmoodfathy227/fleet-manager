import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('coordinator_school_assignments')
      .select('school_id, schools(id, name)')
      .eq('employee_id', id)

    if (error) throw error

    const schools = (data || [])
      .map((row: any) => {
        const school = row.schools
        if (Array.isArray(school)) return school[0]
        return school
      })
      .filter(Boolean)

    return NextResponse.json({ schools })
  } catch (error: any) {
    console.error('Error fetching coordinator schools:', error)
    return NextResponse.json({ error: error.message, schools: [] }, { status: 500 })
  }
}
