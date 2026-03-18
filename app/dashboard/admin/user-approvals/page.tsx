import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UserApprovalsClient from './UserApprovalsClient'

async function getPendingUsers() {
  const supabase = await createClient()
  
  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: currentUser } = await supabase
    .from('users')
    .select('role, approval_status')
    .eq('email', user.email)
    .single()

  if (!currentUser || currentUser.role !== 'admin' || currentUser.approval_status !== 'approved') {
    redirect('/dashboard')
  }

  // Fetch pending users
  const { data: pendingUsers, error } = await supabase
    .from('users')
    .select('*')
    .in('approval_status', ['pending', 'rejected'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending users:', error)
    return { pendingUsers: [], error: error.message }
  }

  return { pendingUsers: pendingUsers || [], error: null }
}

export default async function UserApprovalsPage() {
  const { pendingUsers, error } = await getPendingUsers()

  return <UserApprovalsClient initialUsers={pendingUsers} error={error} />
}

