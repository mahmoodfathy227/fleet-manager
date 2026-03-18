import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if function exists
    const { data: functionCheck, error: checkError } = await supabase
      .rpc('pg_get_function_identity_arguments', {
        function_name: 'create_certificate_notifications'
      })
      .select('*')
      .limit(1)

    // Alternative: Try to call the function with a test (will fail gracefully if it doesn't exist)
    const { error: testError } = await supabase.rpc('create_certificate_notifications')

    if (testError) {
      if (testError.message?.includes('function') && testError.message?.includes('does not exist')) {
        return NextResponse.json({
          exists: false,
          error: 'Function does not exist. Please run migration 052_create_notifications_system.sql',
          message: testError.message
        })
      }
      // Function exists but has an error
      return NextResponse.json({
        exists: true,
        error: 'Function exists but encountered an error',
        message: testError.message,
        details: testError.details,
        hint: testError.hint
      })
    }

    return NextResponse.json({
      exists: true,
      working: true,
      message: 'Function exists and is working correctly'
    })
  } catch (error: any) {
    return NextResponse.json({
      exists: false,
      error: 'Unable to check function',
      message: error.message
    }, { status: 500 })
  }
}

