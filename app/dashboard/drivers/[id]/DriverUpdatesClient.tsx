'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Plus, Edit2, Trash2, MessageSquare } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface DriverUpdatesClientProps {
  driverId: number
}

export default function DriverUpdatesClient({ driverId }: DriverUpdatesClientProps) {
  const supabase = createClient()
  const [updates, setUpdates] = useState<any[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)
  const [newUpdateText, setNewUpdateText] = useState('')
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null)
  const [editingUpdateText, setEditingUpdateText] = useState('')

  useEffect(() => {
    loadUpdates()
  }, [driverId])

  const loadUpdates = async () => {
    setLoadingUpdates(true)
    const { data, error } = await supabase
      .from('driver_updates')
      .select('*, users(email)')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setUpdates(data)
    }
    setLoadingUpdates(false)
  }

  const handleAddUpdate = async () => {
    if (!newUpdateText.trim()) return

    // Get current user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      alert('You must be logged in to add an update')
      return
    }

    // Get user ID from users table
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('email', authUser.email)
      .maybeSingle()

    const { error } = await supabase
      .from('driver_updates')
      .insert([{
        driver_id: driverId,
        update_text: newUpdateText,
        updated_by: userData?.id || null,
      }])

    if (!error) {
      loadUpdates()
      setNewUpdateText('')
    } else {
      alert('Failed to add update: ' + error.message)
    }
  }

  const handleEditUpdate = async (updateId: number) => {
    const { error } = await supabase
      .from('driver_updates')
      .update({ update_text: editingUpdateText })
      .eq('id', updateId)

    if (!error) {
      loadUpdates()
      setEditingUpdateId(null)
      setEditingUpdateText('')
    } else {
      alert('Failed to update: ' + error.message)
    }
  }

  const handleDeleteUpdate = async (updateId: number) => {
    if (!confirm('Are you sure you want to delete this update?')) return

    const { error } = await supabase
      .from('driver_updates')
      .delete()
      .eq('id', updateId)

    if (!error) {
      loadUpdates()
    } else {
      alert('Failed to delete update: ' + error.message)
    }
  }

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <CardTitle className="flex items-center">
          <MessageSquare className="mr-2 h-5 w-5" />
          Driver Updates & Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Add New Update */}
        <div className="border border-gray-300 rounded-lg p-4 bg-blue-50">
          <Label htmlFor="new-update" className="text-sm font-medium text-gray-700">Add New Update</Label>
          <textarea
            id="new-update"
            rows={3}
            className="mt-2 flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
            placeholder="Enter update or note..."
            value={newUpdateText}
            onChange={(e) => setNewUpdateText(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={handleAddUpdate} disabled={!newUpdateText.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Update
            </Button>
          </div>
        </div>

        {/* Updates List */}
        {loadingUpdates ? (
          <p className="text-sm text-gray-500">Loading updates...</p>
        ) : updates.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No updates recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {updates.map((update: any) => (
              <div key={update.id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">
                      {formatDateTime(update.created_at)} • By: {update.users?.email || 'System'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-navy"
                      onClick={() => {
                        setEditingUpdateId(update.id)
                        setEditingUpdateText(update.update_text)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                      onClick={() => handleDeleteUpdate(update.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {editingUpdateId === update.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={editingUpdateText}
                      onChange={(e) => setEditingUpdateText(e.target.value)}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingUpdateId(null)
                          setEditingUpdateText('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEditUpdate(update.id)}
                        disabled={!editingUpdateText.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.update_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

