'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Plus, MessageSquare, Edit2, Trash2, Image, FileText, Download } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { VehicleUpdate } from '@/lib/types'

interface VehicleUpdatesProps {
  vehicleId: number
}

export default function VehicleUpdates({ vehicleId }: VehicleUpdatesProps) {
  const supabase = createClient()
  const [updates, setUpdates] = useState<VehicleUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)
  const [newUpdateText, setNewUpdateText] = useState('')
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null)
  const [editingUpdateText, setEditingUpdateText] = useState('')

  useEffect(() => {
    loadUpdates()
  }, [vehicleId])

  const loadUpdates = async () => {
    setLoadingUpdates(true)
    const { data, error } = await supabase
      .from('vehicle_updates')
      .select('*, users(email)')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      // Parse file_urls if they exist
      const parsedUpdates = data.map(update => ({
        ...update,
        file_urls: typeof update.file_urls === 'string' 
          ? JSON.parse(update.file_urls) 
          : (update.file_urls || [])
      }))
      setUpdates(parsedUpdates)
    }
    setLoadingUpdates(false)
  }

  const handleAddUpdate = async () => {
    if (!newUpdateText.trim()) return

    const { error } = await supabase
      .from('vehicle_updates')
      .insert([{
        vehicle_id: vehicleId,
        update_text: newUpdateText,
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
      .from('vehicle_updates')
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
      .from('vehicle_updates')
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
          Vehicle Updates & Notes ({updates.length})
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
                      className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      value={editingUpdateText}
                      onChange={(e) => setEditingUpdateText(e.target.value)}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingUpdateId(null)
                          setEditingUpdateText('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleEditUpdate(update.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.update_text}</p>
                    
                    {/* Display attached files */}
                    {update.file_urls && update.file_urls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Attachments:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {update.file_urls.map((fileUrl: string, idx: number) => {
                            const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                            const fileName = fileUrl.split('/').pop() || `file-${idx + 1}`
                            return (
                              <a
                                key={idx}
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group border border-gray-200 rounded p-2 hover:bg-gray-100 transition-colors"
                              >
                                {isImage ? (
                                  <div className="relative">
                                    <img
                                      src={fileUrl}
                                      alt={`Attachment ${idx + 1}`}
                                      className="w-full h-20 object-cover rounded"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded flex items-center justify-center">
                                      <Download className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-20">
                                    <FileText className="h-8 w-8 text-gray-400 mb-1" />
                                    <span className="text-xs text-gray-600 truncate w-full text-center px-1">
                                      {fileName.length > 15 ? fileName.substring(0, 15) + '...' : fileName}
                                    </span>
                                  </div>
                                )}
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

