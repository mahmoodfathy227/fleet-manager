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

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await getUserId()
    const { data, error } = await supabase
      .from('document_requirements')
      .select('*')
      .eq('id', params.id)
      .single()
    if (error) throw error
    return NextResponse.json({ requirement: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load requirement' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, userId } = await getUserId()
    const body = await request.json()
    const updates = {
      ...body,
      code: body?.code ? String(body.code).trim() : null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('document_requirements')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ requirement: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update requirement' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await getUserId()
    const { count } = await supabase
      .from('subject_documents')
      .select('id', { count: 'exact', head: true })
      .eq('requirement_id', params.id)
    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete requirement with existing documents' },
        { status: 400 }
      )
    }
    const { error } = await supabase
      .from('document_requirements')
      .delete()
      .eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete requirement' },
      { status: 500 }
    )
  }
}

