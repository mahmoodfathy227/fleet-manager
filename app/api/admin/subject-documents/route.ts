import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

async function getCallerUserId(): Promise<number | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const svc = createServiceClient()
    if (user.email) {
      const { data } = await svc.from('users').select('id').ilike('email', user.email).maybeSingle()
      if (data?.id) return data.id as number
    }
    return null
  } catch {
    return null
  }
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
    const svc = createServiceClient()
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

    const { data: requirements, error: reqError } = await svc
      .from('document_requirements')
      .select('*')
      .eq('subject_type', subject_type)
      .eq('is_active', true)
      .order('name')

    if (reqError) throw reqError

    const { data: documents, error: docError } = await svc
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

    console.debug('[subject-documents GET] subject_type=%s id=%s docs=%d', subject_type, subject_id, documents?.length ?? 0)
    return NextResponse.json({
      requirements: requirements || [],
      documents: documents || [],
    })
  } catch (error: any) {
    console.error('[subject-documents GET] error', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load subject documents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCallerUserId()
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

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('subject_documents')
      .insert(payload)
      .select('*, document_requirements(*)')
      .single()
    if (error) throw error
    console.debug('[subject-documents POST] created', data?.id)
    return NextResponse.json({ document: data })
  } catch (error: any) {
    console.error('[subject-documents POST] error', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create subject document' },
      { status: 500 }
    )
  }
}
