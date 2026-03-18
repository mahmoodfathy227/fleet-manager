import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc('create_certificate_notifications')

    if (error) {
      console.error('RPC Error:', error)
      // Check if function doesn't exist
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Notification function not found. Please run the migration: 052_create_notifications_system.sql',
            details: error.message 
          },
          { status: 500 }
        )
      }
      throw error
    }

    return NextResponse.json({ 
      success: true,
      message: 'Notifications refreshed successfully'
    })
  } catch (error: any) {
    console.error('Error refreshing notifications:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to refresh notifications',
        details: error.details || error.hint || error.code
      },
      { status: 500 }
    )
  }
}

