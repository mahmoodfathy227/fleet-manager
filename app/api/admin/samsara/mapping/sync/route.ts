import { NextResponse } from 'next/server'
import { hasAnyServerPermission } from '@/lib/auth/server-permissions'
import { syncVehicleMappingsFromSamsara } from '@/lib/samsara/matching-service'

export async function POST() {
  try {
    const isAllowed = await hasAnyServerPermission([
      'users.manage',
      'roles.assign',
      'integrations.samsara.manage',
    ])

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await syncVehicleMappingsFromSamsara()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync vehicle mappings' },
      { status: 500 }
    )
  }
}
