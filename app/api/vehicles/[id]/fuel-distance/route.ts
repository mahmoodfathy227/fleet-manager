import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const vehicleId = Number(params.id)
  if (!Number.isFinite(vehicleId)) {
    return NextResponse.json({ error: 'Invalid vehicle id' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) },
    }
  )

  const { data, error } = await supabase
    .from('vehicle_fuel_distance')
    .select('*')
    .eq('vehicle_db_id', vehicleId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
