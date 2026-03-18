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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, userId } = await getUserId()
    const body = await request.json()
    const updates = {
      ...body,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('subject_documents')
      .update(updates)
      .eq('id', params.id)
      .select('*, document_requirements(*)')
      .single()
    if (error) throw error
    return NextResponse.json({ document: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update subject document' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await getUserId()
    const { error } = await supabase
      .from('subject_documents')
      .delete()
      .eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete subject document' },
      { status: 500 }
    )
  }
}

