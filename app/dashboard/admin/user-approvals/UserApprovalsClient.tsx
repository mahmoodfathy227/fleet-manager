'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Mail,
  Calendar,
  UserCheck
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface User {
  id: number
  email: string
  full_name: string | null
  role: string | null
  approval_status: string | null
  created_at: string
  reviewed_by: number | null
  reviewed_at: string | null
  admin_notes: string | null
}

interface UserApprovalsClientProps {
  initialUsers: User[]
  error: string | null
}

export default function UserApprovalsClient({ initialUsers, error: initialError }: UserApprovalsClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const supabase = createClient()

  useEffect(() => {
    filterUsers()
  }, [searchTerm, users])

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(term) ||
      (user.full_name && user.full_name.toLowerCase().includes(term)) ||
      (user.role && user.role.toLowerCase().includes(term)) ||
      (user.approval_status && user.approval_status.toLowerCase().includes(term))
    )
    setFilteredUsers(filtered)
  }

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .in('approval_status', ['pending', 'rejected'])
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setUsers(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: number) => {
    if (!confirm('Are you sure you want to approve this user?')) return

    setActionLoading(userId)
    setError(null)
    setSuccess(null)

    try {
      // Get current admin user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      const { data: adminUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single()

      const { error: updateError, data: updatedData } = await supabase
        .from('users')
        .update({
          approval_status: 'approved',
          reviewed_by: adminUser?.id || null,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes || null,
        })
        .eq('id', userId)
        .select()

      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }

      // Verify the update worked
      if (!updatedData || updatedData.length === 0) {
        throw new Error('User not found or update failed')
      }

      const updatedUser = updatedData[0]
      if (updatedUser.approval_status !== 'approved') {
        throw new Error('Approval status was not updated correctly')
      }

      setSuccess(`User ${updatedUser.email} approved successfully! They can now log in.`)
      setAdminNotes('')
      setSelectedUser(null)
      await loadUsers()
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to approve user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (userId: number) => {
    if (!adminNotes.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    if (!confirm('Are you sure you want to reject this user?')) return

    setActionLoading(userId)
    setError(null)
    setSuccess(null)

    try {
      // Get current admin user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      const { data: adminUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single()

      const { error: updateError } = await supabase
        .from('users')
        .update({
          approval_status: 'rejected',
          reviewed_by: adminUser?.id || null,
          reviewed_at: new Date().toISOString(),
          admin_notes: adminNotes,
        })
        .eq('id', userId)

      if (updateError) throw updateError

      setSuccess('User rejected successfully')
      setAdminNotes('')
      setSelectedUser(null)
      await loadUsers()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to reject user')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="mr-1 h-3 w-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </span>
        )
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <UserCheck className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Approvals</h1>
            <p className="text-sm text-slate-500">
              Review and approve or reject new user signups
            </p>
          </div>
        </div>
        <Button onClick={loadUsers} disabled={loading} variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      <Card>
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="flex items-center text-slate-900 text-base font-semibold">
            <UserCheck className="mr-2 h-5 w-5 text-slate-500" />
            Pending User Approvals ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name, email, role, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No pending users found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {user.full_name || 'No name provided'}
                          </div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </div>
                        {getStatusBadge(user.approval_status)}
                      </div>
                      <div className="ml-7 space-y-1 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Role:</span>
                          <span>{user.role || 'Not specified'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-3 w-3" />
                          <span>Signed up: {formatDateTime(user.created_at)}</span>
                        </div>
                        {user.reviewed_at && (
                          <div className="flex items-center space-x-2">
                            <span>Reviewed: {formatDateTime(user.reviewed_at)}</span>
                          </div>
                        )}
                        {user.admin_notes && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                            <span className="font-medium">Admin Notes:</span> {user.admin_notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {user.approval_status === 'pending' && (
                        <>
                          <Button
                            onClick={() => {
                              setSelectedUser(user)
                              setAdminNotes('')
                            }}
                            variant="outline"
                            size="sm"
                            className="text-slate-600 border-slate-300 hover:bg-slate-50"
                          >
                            Review
                          </Button>
                        </>
                      )}
                      {user.approval_status === 'rejected' && (
                        <Button
                          onClick={() => {
                            setSelectedUser(user)
                            setAdminNotes('')
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          Re-review
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center justify-between rounded-t-lg">
              <h2 className="text-xl font-bold text-slate-900">Review User Signup</h2>
              <button
                onClick={() => {
                  setSelectedUser(null)
                  setAdminNotes('')
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                <div className="mt-1 text-sm text-gray-900">{selectedUser.full_name || 'Not provided'}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Email</Label>
                <div className="mt-1 text-sm text-gray-900">{selectedUser.email}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Role</Label>
                <div className="mt-1 text-sm text-gray-900">{selectedUser.role || 'Not specified'}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Signed Up</Label>
                <div className="mt-1 text-sm text-gray-900">{formatDateTime(selectedUser.created_at)}</div>
              </div>
              <div>
                <Label htmlFor="admin-notes" className="text-sm font-medium text-gray-700">
                  Admin Notes {selectedUser.approval_status === 'rejected' && <span className="text-red-500">*</span>}
                </Label>
                <textarea
                  id="admin-notes"
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Add notes about this user (required for rejection)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
                {selectedUser.approval_status === 'rejected' && selectedUser.admin_notes && (
                  <p className="mt-1 text-xs text-gray-500">Previous notes: {selectedUser.admin_notes}</p>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedUser(null)
                    setAdminNotes('')
                  }}
                  disabled={actionLoading !== null}
                  className="text-slate-600 border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                {selectedUser.approval_status === 'pending' && (
                  <>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => handleReject(selectedUser.id)}
                      disabled={actionLoading !== null || !adminNotes.trim()}
                    >
                      {actionLoading === selectedUser.id ? 'Rejecting...' : 'Reject'}
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedUser.id)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === selectedUser.id ? 'Approving...' : 'Approve'}
                    </Button>
                  </>
                )}
                {selectedUser.approval_status === 'rejected' && (
                  <Button
                    onClick={() => handleApprove(selectedUser.id)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === selectedUser.id ? 'Approving...' : 'Approve'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

