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

const SUBJECT_DOCUMENT_PATCH_KEYS = [
  'status',
  'certificate_number',
  'issue_date',
  'expiry_date',
  'notes',
] as const

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCallerUserId()
    const body = await request.json()
    const updates: Record<string, unknown> = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
    for (const key of SUBJECT_DOCUMENT_PATCH_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updates[key] = body[key]
      }
    }
    console.debug('[subject-documents PATCH] id=%s updates=%o', params.id, updates)
    const svc = createServiceClient()
    const { data, error } = await svc
      .from('subject_documents')
      .update(updates)
      .eq('id', params.id)
      .select('*, document_requirements(*)')
      .single()
    if (error) throw error
    console.debug('[subject-documents PATCH] saved', data)
    return NextResponse.json({ document: data })
  } catch (error: any) {
    console.error('[subject-documents PATCH] error', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update subject document' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const svc = createServiceClient()
    const { error } = await svc
      .from('subject_documents')
      .delete()
      .eq('id', params.id)
    if (error) throw error
    console.debug('[subject-documents DELETE] id=%s', params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[subject-documents DELETE] error', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete subject document' },
      { status: 500 }
    )
  }
}
