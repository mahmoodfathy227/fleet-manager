'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'

interface VORToggleButtonProps {
  vehicleId: number
  currentVORStatus: boolean
}

export default function VORToggleButton({ vehicleId, currentVORStatus }: VORToggleButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    if (!note.trim()) {
      setError('Note is required when changing VOR status')
      return
    }

    setLoading(true)
    setError(null)
    const newVORStatus = !currentVORStatus

    try {
      // Update vehicle VOR status
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({ 
          off_the_road: newVORStatus
        })
        .eq('id', vehicleId)

      if (updateError) throw updateError

      // Create update entry in vehicle_updates table
      const vorAction = newVORStatus ? 'VOR' : 'Active'
      const updateText = `Status changed to ${vorAction}: ${note.trim()}`

      const { error: insertError } = await supabase
        .from('vehicle_updates')
        .insert([{
          vehicle_id: vehicleId,
          update_text: updateText,
        }])

      if (insertError) {
        console.error('Error creating vehicle update:', insertError)
        // Don't throw - VOR status was updated, just the note failed
      }

      setShowModal(false)
      setNote('')
      router.refresh()
    } catch (error: any) {
      console.error('Error updating vehicle VOR status:', error)
      setError('Failed to update vehicle status: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        variant={currentVORStatus ? 'secondary' : 'primary'}
        className={currentVORStatus ? '' : 'bg-red-600 hover:bg-red-700'}
      >
        {currentVORStatus ? (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark as Active
          </>
        ) : (
          <>
            <AlertTriangle className="mr-2 h-4 w-4" />
            Mark as VOR
          </>
        )}
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="bg-navy text-white p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {currentVORStatus ? 'Mark Vehicle as Active' : 'Mark Vehicle as VOR'}
              </h2>
              <button 
                onClick={() => {
                  setShowModal(false)
                  setNote('')
                  setError(null)
                }}
                className="text-white hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="vor-note" className="text-sm font-medium text-gray-700">
                  Note <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-500 mt-1 mb-2">
                  {currentVORStatus 
                    ? 'Please provide a note explaining why the vehicle is being marked as active.'
                    : 'Please provide a note explaining why the vehicle is being marked as VOR (Vehicle Off Road).'}
                </p>
                <textarea
                  id="vor-note"
                  rows={4}
                  required
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
                  placeholder="Enter note..."
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    setError(null)
                  }}
                />
                {error && (
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false)
                    setNote('')
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleToggle}
                  disabled={loading || !note.trim()}
                  className={currentVORStatus ? '' : 'bg-green-600 hover:bg-green-700'}
                >
                  {loading ? 'Updating...' : currentVORStatus ? 'Mark as Active' : 'Mark as VOR'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

