import { NextRequest, NextResponse } from 'next/server'
import { hasAnyServerPermission } from '@/lib/auth/server-permissions'
import { syncVehicleMappingsFromSamsara } from '@/lib/samsara/matching-service'
import { syncTelematicsSnapshots } from '@/lib/samsara/telematics-sync-service'

function isAuthorizedByToken(request: NextRequest): boolean {
  const expected = process.env.SAMSARA_SYNC_TOKEN
  if (!expected) return false
  const incoming = request.headers.get('x-sync-token')
  return Boolean(incoming && incoming === expected)
}

export async function POST(request: NextRequest) {
  try {
    const tokenAuthorized = isAuthorizedByToken(request)
    const permissionAuthorized = await hasAnyServerPermission([
      'users.manage',
      'roles.assign',
      'integrations.samsara.manage',
    ])

    if (!tokenAuthorized && !permissionAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const mode = String(body.mode || 'all')

    let mapping = null
    let telematics = null

    if (mode === 'all' || mode === 'mapping') {
      mapping = await syncVehicleMappingsFromSamsara()
    }

    if (mode === 'all' || mode === 'telematics') {
      telematics = await syncTelematicsSnapshots()
    }

    return NextResponse.json({
      success: true,
      mode,
      mapping,
      telematics,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Samsara sync failed' },
      { status: 500 }
    )
  }
}
