import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_BUCKETS = ['VEHICLE_DOCUMENTS', 'DRIVER_DOCUMENTS', 'PA_DOCUMENTS', 'EMPLOYEE_DOCUMENTS', 'MAINTENANCE_ICONS'] as const

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}

/**
 * GET /api/documents/view?bucket=VEHICLE_DOCUMENTS&path=vehicles/107/file.pdf
 * Streams the file from Supabase storage. Requires authenticated user.
 * URL stays on your domain; only logged-in users can access.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get('bucket') ?? 'VEHICLE_DOCUMENTS'
  const path = searchParams.get('path')

  if (!path || path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  if (!ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
    return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path)

  if (error) {
    console.error('Document view error:', error)
    return NextResponse.json({ error: error.message || 'File not found' }, { status: error.message?.includes('not found') ? 404 : 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const contentType = mimeFromPath(path)
  const filename = path.split('/').pop() ?? 'document'

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
