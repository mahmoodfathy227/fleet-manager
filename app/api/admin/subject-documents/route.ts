import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, userId: null }
  let userId: number | null = null
  const byAuthId = await supabase.from('users').select('id').eq('user_id', user.id).maybeSingle()
  if (byAuthId.data?.id) userId = byAuthId.data.id
  if (userId == null && user.email) {
    const byEmail = await supabase.from('users').select('id').ilike('email', user.email).maybeSingle()
    if (byEmail.data?.id) userId = byEmail.data.id
  }
  return { supabase, userId }
}

function buildSubjectFilter(subjectType: string, subjectId: string) {
  const id = Number(subjectId)
  if (!Number.isInteger(id)) return null
  if (subjectType === 'driver') return { driver_employee_id: id }
  if (subjectType === 'pa') return { pa_employee_id: id }
  if (subjectType === 'vehicle') return { vehicle_id: id }
  if (subjectType === 'employee') return { employee_id: id }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await getUserId()
    const params = request.nextUrl.searchParams
    const subject_type = params.get('subject_type')
    const subject_id = params.get('subject_id')

    if (!subject_type || !subject_id) {
      return NextResponse.json({ error: 'subject_type and subject_id required' }, { status: 400 })
    }

    const subjectFilter = buildSubjectFilter(subject_type, subject_id)
    if (!subjectFilter) {
      return NextResponse.json({ error: 'Invalid subject_id' }, { status: 400 })
    }

    const { data: requirements, error: reqError } = await supabase
      .from('document_requirements')
      .select('*')
      .eq('subject_type', subject_type)
      .eq('is_active', true)
      .order('name')

    if (reqError) throw reqError

    const { data: documents, error: docError } = await supabase
      .from('subject_documents')
      .select(`
        *,
        document_requirements(*),
        document_subject_document_links(
          document_id,
          documents(id, file_name, file_url, file_path)
        )
      `)
      .match({ subject_type, ...subjectFilter })
      .order('created_at', { ascending: false })

    if (docError) throw docError

    return NextResponse.json({
      requirements: requirements || [],
      documents: documents || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load subject documents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await getUserId()
    const body = await request.json()
    const {
      requirement_id,
      subject_type,
      subject_id,
      status,
      certificate_number,
      issue_date,
      expiry_date,
      notes,
    } = body || {}

    if (!requirement_id || !subject_type || !subject_id) {
      return NextResponse.json({ error: 'requirement_id, subject_type, subject_id required' }, { status: 400 })
    }

    const subjectFilter = buildSubjectFilter(subject_type, String(subject_id))
    if (!subjectFilter) {
      return NextResponse.json({ error: 'Invalid subject_id' }, { status: 400 })
    }

    const payload = {
      requirement_id,
      subject_type,
      ...subjectFilter,
      status: status || 'missing',
      certificate_number: certificate_number || null,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      notes: notes || null,
      created_by: userId,
      updated_by: userId,
    }

    const { data, error } = await supabase
      .from('subject_documents')
      .insert(payload)
      .select('*, document_requirements(*)')
      .single()
    if (error) throw error
    return NextResponse.json({ document: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create subject document' },
      { status: 500 }
    )
  }
}

