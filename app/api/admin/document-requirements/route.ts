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

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await getUserId()
    const params = request.nextUrl.searchParams
    const subject_type = params.get('subject_type')
    const criticality = params.get('criticality')
    const is_active = params.get('is_active')
    const is_required = params.get('is_required')
    const search = params.get('search')

    let query = supabase
      .from('document_requirements')
      .select('*')
      .order('updated_at', { ascending: false })

    if (subject_type) query = query.eq('subject_type', subject_type)
    if (criticality) query = query.eq('criticality', criticality)
    if (is_active != null && is_active !== '') query = query.eq('is_active', is_active === 'true')
    if (is_required != null && is_required !== '') query = query.eq('is_required', is_required === 'true')
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ requirements: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load requirements' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await getUserId()
    const body = await request.json()
    const {
      name,
      code,
      subject_type,
      requires_expiry,
      requires_upload,
      requires_number,
      criticality,
      default_validity_days,
      renewal_notice_days,
      is_required,
      is_active,
      icon_path,
      color,
    } = body || {}

    if (!name || !subject_type) {
      return NextResponse.json({ error: 'name and subject_type are required' }, { status: 400 })
    }

    const payload = {
      name: String(name).trim(),
      code: code ? String(code).trim() : null,
      subject_type,
      requires_expiry: !!requires_expiry,
      requires_upload: !!requires_upload,
      requires_number: !!requires_number,
      criticality: criticality || 'recommended',
      default_validity_days: default_validity_days ?? null,
      renewal_notice_days: renewal_notice_days ?? null,
      is_required: is_required !== undefined ? !!is_required : true,
      is_active: is_active !== undefined ? !!is_active : true,
      icon_path: icon_path || null,
      color: color || null,
      created_by: userId,
      updated_by: userId,
    }

    const { data, error } = await supabase
      .from('document_requirements')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ requirement: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create requirement' },
      { status: 500 }
    )
  }
}

