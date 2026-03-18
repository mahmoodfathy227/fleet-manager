import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = typeof params === 'object' && params !== null && 'id' in params
      ? (params as { id: string }).id
      : null
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        drivers (
          tas_badge_number,
          tas_badge_expiry_date,
          taxi_badge_number,
          taxi_badge_expiry_date,
          dbs_expiry_date,
          psv_license,
          self_employed,
          first_aid_certificate_expiry_date,
          passport_expiry_date,
          driving_license_expiry_date,
          cpc_expiry_date,
          utility_bill_date,
          vehicle_insurance_expiry_date,
          mot_expiry_date,
          birth_certificate,
          marriage_certificate,
          photo_taken,
          private_hire_badge,
          paper_licence,
          taxi_plate_photo,
          logbook,
          safeguarding_training_completed,
          safeguarding_training_date,
          tas_pats_training_completed,
          tas_pats_training_date,
          psa_training_completed,
          psa_training_date,
          additional_notes
        ),
        passenger_assistants (
          id,
          tas_badge_number,
          tas_badge_expiry_date,
          dbs_expiry_date
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const sanitized = JSON.parse(JSON.stringify(data))
    return NextResponse.json(sanitized)
  } catch (e) {
    console.error('Employee detail API error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
