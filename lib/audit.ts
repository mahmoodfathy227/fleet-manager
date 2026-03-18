import { createClient } from '@/lib/supabase/server'

export async function logAudit(
  tableName: string,
  recordId: number,
  action: 'CREATE' | 'UPDATE' | 'DELETE'
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Get the user's ID from the users table
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (!userData) return

    await supabase.from('audit_log').insert({
      table_name: tableName,
      record_id: recordId,
      action: action,
      changed_by: userData.id,
    })
  } catch (error) {
    console.error('Error logging audit:', error)
  }
}

